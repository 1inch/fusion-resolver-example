import {ethers} from 'hardhat'
import {ResolverExample, ResolverExample__factory} from '../typechain-types'
import {
    ONE_INCH_LOP_V4,
    SETTLEMENT_EXTENSION,
    TOKENS
} from './helpers/constants'
import {getChainId, nowSec, parseAmount, randomBigInt} from './helpers/utils'
import {createUsers} from './helpers/accounts'
import {
    Address,
    AmountMode,
    AuctionDetails,
    FusionOrder,
    Interaction,
    LimitOrderContract,
    NetworkEnum,
    TakerTraits
} from '@1inch/fusion-sdk'
import {expect} from 'chai'
import {balanceOf, encodeInfinityApprove, tokenName} from './helpers/erc20'
import {OneInchApi} from './helpers/1inch'
import {AbiCoder} from 'ethers'
import * as process from 'process'
import {buildDaiLikePermit, buildPermit} from './helpers/permit'
import {ChainId} from '@1inch/permit-signed-approvals-utils'

// eslint-disable-next-line max-lines-per-function
describe('Settle Orders', async function () {
    let resolverContract: ResolverExample
    let resolverAddress: string
    const [resolverEOA, userA, userB] = createUsers()

    const whitelist = [] as {address: Address; allowFrom: bigint}[]
    before(async function () {
        const chainId = await getChainId()

        if (chainId !== 1n) {
            throw new Error(
                'tests only working with ethereum mainnet fork (chainId == 1)'
            )
        }

        const ResolverExample = (await ethers.getContractFactory<
            [string, string],
            ResolverExample
        >(
            'ResolverExample',
            await resolverEOA.getSigner()
        )) as ResolverExample__factory

        resolverContract = await ResolverExample.deploy(ONE_INCH_LOP_V4)
        await resolverContract.waitForDeployment()
        resolverContract = resolverContract.connect(
            await resolverEOA.getSigner()
        ) // call contract from owner
        resolverAddress = await resolverContract.getAddress()

        whitelist.push({
            address: new Address(resolverAddress),
            allowFrom: 0n
        })

        await userA.donorToken('WETH', parseAmount('100'))
        await userA.donorToken('DAI', parseAmount('1000000'))
        await userB.donorToken('USDC', parseAmount('1000000', 6))
        await userB.donorToken('1INCH', parseAmount('100000'))

        await userA.unlimitedApprove('WETH', ONE_INCH_LOP_V4)
        await userB.unlimitedApprove('USDC', ONE_INCH_LOP_V4)
        // -- for DAI we'll use permit
        // -- for 1INCH we'll use permit

        // Approve all tokens from Resolver contract to Limit Order Protocol
        await Promise.all(
            Object.values(TOKENS).map((tokenAddress) =>
                resolverContract.approve(tokenAddress, ONE_INCH_LOP_V4)
            )
        )
    })

    it('should resolve order through 1inch Router swap', async function () {
        const devToken = process.env.ONE_INCH_API_KEY

        if (!devToken) {
            this.skip()
        }

        const auctionDetails = new AuctionDetails({
            startTime: nowSec(),
            initialRateBump: 0,
            duration: 180n,
            points: []
        })

        const orderA = FusionOrder.new(
            new Address(SETTLEMENT_EXTENSION),
            {
                makerAsset: new Address(TOKENS.WETH),
                takerAsset: new Address(TOKENS.USDC),
                makingAmount: parseAmount('1'),
                takingAmount: parseAmount('1000', 6),
                maker: new Address(userA.address)
            },
            {
                auction: auctionDetails,
                whitelist,
                resolvingStartTime: 0n
            }
        )

        const oneInchApi = new OneInchApi({
            url: 'https://api.1inch.dev',
            network: NetworkEnum.ETHEREUM,
            token: devToken
        })

        const {tx} = await oneInchApi.requestSwapData({
            fromToken: TOKENS.WETH,
            toToken: TOKENS.USDC,
            amount: orderA.makingAmount.toString(),
            fromAddress: resolverAddress,
            disableEstimate: true,
            slippage: 1,
            protocols: ['UNISWAP_V2']
        })

        const targets = [TOKENS.WETH, tx.to]
        const callDataList = [encodeInfinityApprove(tx.to), tx.data]

        const resolverExecutionBytes = AbiCoder.defaultAbiCoder().encode(
            ['address[]', 'bytes[]'],
            [targets, callDataList]
        )

        const takerTraits = TakerTraits.default()
            .setExtension(orderA.extension)
            .setInteraction(
                new Interaction(
                    new Address(resolverAddress),
                    resolverExecutionBytes
                )
            )
            .setAmountMode(AmountMode.maker)
            .setAmountThreshold(parseAmount('1000', 6))

        const calldata = LimitOrderContract.getFillOrderArgsCalldata(
            orderA.build(),
            userA.signFusionOrder(orderA),
            takerTraits,
            parseAmount('1')
        )

        const resolverBalanceBefore = await balanceOf(
            TOKENS.USDC,
            resolverAddress
        )

        const transaction = await resolverEOA.sendTransaction({
            to: resolverAddress,
            data: resolverContract.interface.encodeFunctionData(
                'settleOrders',
                [calldata]
            ),
            value: '0'
        })

        const receipt = await transaction.wait()

        const resolverBalanceAfter = await balanceOf(
            TOKENS.USDC,
            resolverAddress
        )

        const balanceDiff = resolverBalanceAfter - resolverBalanceBefore

        expect(receipt.status).to.be.eq(1, 'transaction failed')
        expect(balanceDiff > 0n, 'wrong profit').to.be.true
    })

    it('should match opposite orders with permits', async function () {
        const auctionDetails = new AuctionDetails({
            startTime: nowSec(),
            initialRateBump: 0,
            duration: 180n,
            points: []
        })

        const permitNonce = await userA.getPermitNonce('DAI', ONE_INCH_LOP_V4)

        const permit = await buildDaiLikePermit({
            userPrivateKey: userA.PK,
            spender: ONE_INCH_LOP_V4,
            value: parseAmount('100').toString(),
            nonce: Number(permitNonce),
            tokenName: await tokenName(TOKENS.DAI),
            tokenAddress: TOKENS.DAI,
            chainId: ChainId.etherumMainnet
        })

        const orderA = FusionOrder.new(
            new Address(SETTLEMENT_EXTENSION),
            {
                makerAsset: new Address(TOKENS.DAI),
                takerAsset: new Address(TOKENS['1INCH']),
                makingAmount: parseAmount('100'),
                takingAmount: parseAmount('10'),
                maker: new Address(userA.address)
            },
            {
                auction: auctionDetails,
                whitelist,
                resolvingStartTime: 0n
            },
            {
                permit
            }
        )

        const permitInchNonce = await userB.getPermitNonce(
            '1INCH',
            ONE_INCH_LOP_V4
        )

        const permitInch = await buildPermit({
            userPrivateKey: userB.PK,
            spender: ONE_INCH_LOP_V4,
            value: parseAmount('100').toString(),
            nonce: Number(permitInchNonce),
            tokenName: await tokenName(TOKENS['1INCH']),
            tokenAddress: TOKENS['1INCH'],
            chainId: ChainId.etherumMainnet
        })

        const orderB = FusionOrder.new(
            new Address(SETTLEMENT_EXTENSION),
            {
                makerAsset: new Address(TOKENS['1INCH']),
                takerAsset: new Address(TOKENS.DAI),
                makingAmount: parseAmount('20'),
                takingAmount: parseAmount('100'),
                maker: new Address(userB.address)
            },
            {
                auction: auctionDetails,
                whitelist,
                resolvingStartTime: 0n
            },
            {
                permit: permitInch
            }
        )

        // Fill second order in callback for first order
        const targets = [ONE_INCH_LOP_V4]
        const callDataList = [
            LimitOrderContract.getFillOrderArgsCalldata(
                orderB.build(),
                userB.signFusionOrder(orderB),
                TakerTraits.default()
                    .setExtension(orderB.extension)
                    .setAmountMode(AmountMode.maker)
                    .setAmountThreshold(parseAmount('100')),
                parseAmount('20')
            )
        ]

        const resolverExecutionBytes = AbiCoder.defaultAbiCoder().encode(
            ['address[]', 'bytes[]'],
            [targets, callDataList]
        )

        const calldata = LimitOrderContract.getFillOrderArgsCalldata(
            orderA.build(),
            userA.signFusionOrder(orderA),
            TakerTraits.default()
                .setExtension(orderA.extension)
                .setInteraction(
                    new Interaction(
                        new Address(resolverAddress),
                        resolverExecutionBytes
                    )
                )
                .setAmountMode(AmountMode.maker)
                .setAmountThreshold(parseAmount('10')),
            parseAmount('100')
        )

        const resolverBalanceBefore = await balanceOf(
            TOKENS['1INCH'],
            resolverAddress
        )

        const tx = await resolverEOA.sendTransaction({
            to: resolverAddress,
            data: resolverContract.interface.encodeFunctionData(
                'settleOrders',
                [calldata]
            ),
            value: '0'
        })

        const receipt = await tx.wait()

        const resolverBalanceAfter = await balanceOf(
            TOKENS['1INCH'],
            resolverAddress
        )

        const profit = parseAmount('10')
        const balanceDiff = (
            resolverBalanceAfter - resolverBalanceBefore
        ).toString()

        expect(receipt.status).to.be.eq(1, 'transaction failed')
        expect(balanceDiff).to.be.eq(profit, 'wrong profit')
    })

    it('should match opposite orders', async function () {
        const auctionDetails = new AuctionDetails({
            startTime: nowSec(),
            initialRateBump: 0,
            duration: 180n,
            points: []
        })

        const orderA = FusionOrder.new(
            new Address(SETTLEMENT_EXTENSION),
            {
                makerAsset: new Address(TOKENS.WETH),
                takerAsset: new Address(TOKENS.USDC),
                makingAmount: parseAmount('1'),
                takingAmount: parseAmount('1000', 6),
                maker: new Address(userA.address)
            },
            {
                auction: auctionDetails,
                whitelist,
                resolvingStartTime: 0n
            },
            {
                nonce: randomBigInt()
            }
        )

        const orderB = FusionOrder.new(
            new Address(SETTLEMENT_EXTENSION),
            {
                makerAsset: new Address(TOKENS.USDC),
                takerAsset: new Address(TOKENS.WETH),
                makingAmount: parseAmount('1010', 6),
                takingAmount: parseAmount('1'),
                maker: new Address(userB.address)
            },
            {
                auction: auctionDetails,
                whitelist,
                resolvingStartTime: 0n
            },
            {
                nonce: randomBigInt()
            }
        )

        // Fill second order in callback for first order
        const targets = [ONE_INCH_LOP_V4]
        const callDataList = [
            LimitOrderContract.getFillOrderArgsCalldata(
                orderB.build(),
                userB.signFusionOrder(orderB),
                TakerTraits.default()
                    .setExtension(orderB.extension)
                    .setAmountMode(AmountMode.maker)
                    .setAmountThreshold(parseAmount('1')),
                parseAmount('1010', 6)
            )
        ]

        const resolverExecutionBytes = AbiCoder.defaultAbiCoder().encode(
            ['address[]', 'bytes[]'],
            [targets, callDataList]
        )

        const calldata = LimitOrderContract.getFillOrderArgsCalldata(
            orderA.build(),
            userA.signFusionOrder(orderA),
            TakerTraits.default()
                .setExtension(orderA.extension)
                .setInteraction(
                    new Interaction(
                        new Address(resolverAddress),
                        resolverExecutionBytes
                    )
                )
                .setAmountMode(AmountMode.maker)
                .setAmountThreshold(parseAmount('1000', 6)),
            parseAmount('1')
        )

        const resolverBalanceBefore = await balanceOf(
            TOKENS.USDC,
            resolverAddress
        )

        const tx = await resolverEOA.sendTransaction({
            to: resolverAddress,
            data: resolverContract.interface.encodeFunctionData(
                'settleOrders',
                [calldata]
            ),
            value: '0'
        })

        const receipt = await tx.wait()

        const resolverBalanceAfter = await balanceOf(
            TOKENS.USDC,
            resolverAddress
        )

        const profit = parseAmount('10', 6)
        const balanceDiff = (
            resolverBalanceAfter - resolverBalanceBefore
        ).toString()

        expect(receipt.status).to.be.eq(1, 'transaction failed')
        expect(balanceDiff).to.be.eq(profit, 'wrong profit')
    })
})
