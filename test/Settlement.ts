import {ethers} from 'hardhat'
import {ResolverExample, ResolverExample__factory} from '../typechain'
import {ONE_INCH_LOP_V4, ONE_INCH_ROUTER, SETTLEMENT_EXTENSION, TOKENS} from './helpers/constants'
import {getChainId, nowSec, parseAmount} from './helpers/utils'
import {createUsers} from './helpers/accounts'
import {
    Address,
    AmountMode,
    AuctionDetails,
    FusionOrder,
    Interaction,
    NetworkEnum,
    PostInteractionData,
    TakerTraits
} from '@1inch/fusion-sdk'
import {expect} from 'chai'
import {balanceOf, encodeInfinityApprove, tokenName} from './helpers/erc20'
import {OneInchApi} from './helpers/1inch'
import {buildDaiLikePermit, buildPermit} from './helpers/permit'
import {ChainId} from '@1inch/permit-signed-approvals-utils'
import {LimitOrderContract} from '../../fusion-sdk/dist/limit-order-contract/limit-order-contract'

describe('Settle Orders', function() {
    let resolverContract: ResolverExample

    const [resolverEOA, userA, userB] = createUsers()

    beforeEach(async function() {
        const chainId = await getChainId()

        if (chainId !== 1) {
            throw new Error(
                'tests only working with ethereum mainnet fork (chainId == 1)'
            )
        }

        const ResolverExample = (await ethers.getContractFactory(
            'ResolverExample',
            resolverEOA.getSigner()
        )) as ResolverExample__factory

        resolverContract = await ResolverExample.deploy(SETTLEMENT_EXTENSION, ONE_INCH_LOP_V4)

        await userA.donorToken('WETH', parseAmount('100'))
        await userA.donorToken('DAI', parseAmount('1000000'))
        await userB.donorToken('USDC', parseAmount('1000000', 6))
        await userB.donorToken('1INCH', parseAmount('100000'))

        await userA.unlimitedApprove('WETH', ONE_INCH_LOP_V4)
        await userB.unlimitedApprove('USDC', ONE_INCH_LOP_V4)
        // -- for DAI we'll use permit
        // -- for 1INCH we'll use permit
    })

    it('should resolve order through 1inch Router swap', async function() {
        let auctionStartTime = nowSec()

        const auctionDetails = new AuctionDetails({
            auctionStartTime,
            initialRateBump: 0,
            duration: 180,
            points: []
        })

        const postInteractionData = PostInteractionData.new({
            whitelist: [
                {
                    address: new Address(resolverEOA.address),
                    allowance: 0
                }
            ],
            auctionStartTime,
            bankFee: 0n
        })

        const orderA = new FusionOrder(
            {
                makerAsset: new Address(TOKENS.WETH),
                takerAsset: new Address(TOKENS.USDC),
                makingAmount: parseAmount('1'),
                takingAmount: parseAmount('1000', 6),
                maker: new Address(userA.address),
                network: NetworkEnum.ETHEREUM
            },
            auctionDetails,
            postInteractionData,
            {
                unwrapWETH: false,
                deadline: 120n
            }
        )

        const oneInchApi = new OneInchApi({
            url: 'https://api.1inch.io',
            network: NetworkEnum.ETHEREUM
        })

        const {tx} = await oneInchApi.requestSwapData({
            fromToken: TOKENS.WETH,
            toToken: TOKENS.USDC,
            amount: orderA.makingAmount.toString(),
            fromAddress: resolverContract.address,
            disableEstimate: true,
            slippage: 1,
            protocols: ['UNISWAP_V2']
        })

        const targets = [TOKENS.WETH, ONE_INCH_ROUTER]
        const callDataList = [
            encodeInfinityApprove(ONE_INCH_ROUTER),
            tx.data
        ]

        const resolverExecutionBytes = ethers.utils.defaultAbiCoder.encode(
            ['address[]', 'bytes[]'],
            [targets, callDataList]
        )

        const takerTraits = TakerTraits.default()
            .setExtension(orderA.extension)
            .setInteraction(new Interaction(new Address(resolverContract.address), resolverExecutionBytes))
            .setAmountMode(AmountMode.maker)
            .setAmountThreshold(parseAmount('1000', 6))

        const calldata = LimitOrderContract.getFillOrderArgsCalldata(
            orderA,
            userA.signFusionOrder(orderA),
            takerTraits,
            parseAmount('1')
        )

        const resolverBalanceBefore = await balanceOf(
            TOKENS.USDC,
            resolverContract.address
        )

        const transaction = await resolverEOA.sendTransaction({
            to: resolverContract.address,
            data: resolverContract.encodeFunctionData('settleOrders', [calldata]),
            value: '0'
        })

        const receipt = await transaction.wait()

        const resolverBalanceAfter = await balanceOf(
            TOKENS.USDC,
            resolverContract.address
        )

        const balanceDiff = resolverBalanceAfter.sub(resolverBalanceBefore)

        expect(receipt.status).to.be.eq(1, 'transaction failed')
        expect(balanceDiff.gt(0), 'wrong profit').to.be.true
    })
    //
    // it('should match opposite orders with permits', async function() {
    //     const salt = new AuctionSalt({
    //         auctionStartTime: nowSec(),
    //         initialRateBump: 0,
    //         duration: 180,
    //         bankFee: '0'
    //     })
    //
    //     const suffix = new AuctionSuffix({
    //         points: [],
    //         whitelist: [
    //             {
    //                 address: resolverEOA.address,
    //                 allowance: 0
    //             }
    //         ]
    //     })
    //
    //     const permitNonce = await userA.getPermitNonce(
    //         'DAI',
    //         ONE_INCH_LOP_V4
    //     )
    //
    //     const permit = await buildDaiLikePermit({
    //         userPrivateKey: userA.PK,
    //         spender: ONE_INCH_LOP_V4,
    //         value: parseAmount('100'),
    //         nonce: permitNonce.toNumber(),
    //         tokenName: await tokenName(TOKENS.DAI),
    //         tokenAddress: TOKENS.DAI,
    //         chainId: ChainId.etherumMainnet
    //     })
    //
    //     const orderA = new FusionOrder(
    //         {
    //             makerAsset: TOKENS.DAI,
    //             takerAsset: TOKENS['1INCH'],
    //             makingAmount: parseAmount('100'),
    //             takingAmount: parseAmount('10'),
    //             maker: userA.address,
    //             allowedSender: SETTLEMENT_EXTENSION
    //         },
    //         salt,
    //         suffix,
    //         {
    //             permit: TOKENS.DAI + permit.substring(2)
    //         }
    //     )
    //
    //     const permitInchNonce = await userB.getPermitNonce(
    //         '1INCH',
    //         ONE_INCH_LOP_V4
    //     )
    //
    //     const permitInch = await buildPermit({
    //         userPrivateKey: userB.PK,
    //         spender: ONE_INCH_LOP_V4,
    //         value: parseAmount('100'),
    //         nonce: permitInchNonce.toNumber(),
    //         tokenName: await tokenName(TOKENS['1INCH']),
    //         tokenAddress: TOKENS['1INCH'],
    //         chainId: ChainId.etherumMainnet
    //     })
    //
    //     const orderB = new FusionOrder(
    //         {
    //             makerAsset: TOKENS['1INCH'],
    //             takerAsset: TOKENS.DAI,
    //             makingAmount: parseAmount('20'),
    //             takingAmount: parseAmount('100'),
    //             maker: userB.address,
    //             allowedSender: SETTLEMENT_EXTENSION
    //         },
    //         salt,
    //         suffix,
    //         {
    //             permit: TOKENS['1INCH'] + permitInch.substring(2)
    //         }
    //     )
    //
    //     const settlement = new Settlement({
    //         resolverContract: resolverContract.address,
    //         settlementContract: SETTLEMENT_EXTENSION
    //     })
    //
    //     const calldata = settlement.encodeSettleOrders(
    //         [
    //             {
    //                 order: orderA.build(),
    //                 makingAmount: parseAmount('100'),
    //                 takingAmount: '0',
    //                 thresholdAmount: parseAmount('10'),
    //                 target: resolverContract.address,
    //                 signature: userA.signFusionOrder(orderA)
    //             },
    //             {
    //                 order: orderB.build(),
    //                 makingAmount: parseAmount('20'),
    //                 takingAmount: '0',
    //                 thresholdAmount: parseAmount('100'),
    //                 target: resolverContract.address,
    //                 signature: userB.signFusionOrder(orderB)
    //             }
    //         ],
    //         ''
    //     )
    //
    //     const resolverBalanceBefore = await balanceOf(
    //         TOKENS['1INCH'],
    //         resolverContract.address
    //     )
    //
    //     const transaction = await resolverEOA.sendTransaction({
    //         to: SETTLEMENT_EXTENSION,
    //         data: calldata,
    //         value: '0'
    //     })
    //
    //     const receipt = await transaction.wait()
    //
    //     const resolverBalanceAfter = await balanceOf(
    //         TOKENS['1INCH'],
    //         resolverContract.address
    //     )
    //
    //     const balanceDiff = resolverBalanceAfter
    //         .sub(resolverBalanceBefore)
    //         .toString()
    //     const profit = parseAmount('10')
    //
    //     expect(receipt.status).to.be.eq(1, 'transaction failed')
    //     expect(balanceDiff).to.be.eq(profit, 'wrong profit')
    // })
    //
    // it('should match opposite orders', async function() {
    //     const salt = new AuctionSalt({
    //         auctionStartTime: nowSec(),
    //         initialRateBump: 0,
    //         duration: 180,
    //         bankFee: '0'
    //     })
    //
    //     const suffix = new AuctionSuffix({
    //         points: [],
    //         whitelist: [
    //             {
    //                 address: resolverEOA.address,
    //                 allowance: 0
    //             }
    //         ]
    //     })
    //
    //     const orderA = new FusionOrder(
    //         {
    //             makerAsset: TOKENS.WETH,
    //             takerAsset: TOKENS.USDC,
    //             makingAmount: parseAmount('1'),
    //             takingAmount: parseAmount('1000', 6),
    //             maker: userA.address,
    //             allowedSender: SETTLEMENT_EXTENSION
    //         },
    //         salt,
    //         suffix
    //     )
    //
    //     const orderB = new FusionOrder(
    //         {
    //             makerAsset: TOKENS.USDC,
    //             takerAsset: TOKENS.WETH,
    //             makingAmount: parseAmount('1010', 6),
    //             takingAmount: parseAmount('1'),
    //             maker: userB.address,
    //             allowedSender: SETTLEMENT_EXTENSION
    //         },
    //         salt,
    //         suffix
    //     )
    //
    //     const settlement = new Settlement({
    //         resolverContract: resolverContract.address,
    //         settlementContract: SETTLEMENT_EXTENSION
    //     })
    //
    //     const calldata = settlement.encodeSettleOrders(
    //         [
    //             {
    //                 order: orderA.build(),
    //                 makingAmount: parseAmount('1'),
    //                 takingAmount: '0',
    //                 thresholdAmount: parseAmount('1000', 6),
    //                 target: resolverContract.address,
    //                 signature: userA.signFusionOrder(orderA)
    //             },
    //             {
    //                 order: orderB.build(),
    //                 makingAmount: parseAmount('1010', 6),
    //                 takingAmount: '0',
    //                 thresholdAmount: parseAmount('1'),
    //                 target: resolverContract.address,
    //                 signature: userB.signFusionOrder(orderB)
    //             }
    //         ],
    //         ''
    //     )
    //
    //     const resolverBalanceBefore = await balanceOf(
    //         TOKENS.USDC,
    //         resolverContract.address
    //     )
    //
    //     const tx = await resolverEOA.sendTransaction({
    //         to: SETTLEMENT_EXTENSION,
    //         data: calldata,
    //         value: '0'
    //     })
    //
    //     const receipt = await tx.wait()
    //
    //     const resolverBalanceAfter = await balanceOf(
    //         TOKENS.USDC,
    //         resolverContract.address
    //     )
    //
    //     const profit = parseAmount('10', 6)
    //     const balanceDiff = resolverBalanceAfter
    //         .sub(resolverBalanceBefore)
    //         .toString()
    //
    //     expect(receipt.status).to.be.eq(1, 'transaction failed')
    //     expect(balanceDiff).to.be.eq(profit, 'wrong profit')
    // })
})
