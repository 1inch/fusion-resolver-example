import {
    computeAddress,
    Signer,
    TransactionResponse,
    Wallet,
    TransactionRequest,
    SigningKey
} from 'ethers'
import {ethers} from 'hardhat'
import {TOKENS, UNLIMITED_AMOUNT} from './constants'
import {approve, balanceOf, transfer} from './erc20'
import {FusionOrder, NetworkEnum} from '@1inch/fusion-sdk'
import {signTypedData, SignTypedDataVersion} from '@metamask/eth-sig-util'
import {getPermitNonce} from './permit'

export class User {
    public readonly address: string

    private readonly signer: Wallet

    constructor(public readonly privateKey: Buffer) {
        const signingKey = new SigningKey(privateKey)
        this.address = computeAddress(signingKey)
        this.signer = new Wallet(signingKey, ethers.provider)
    }

    get PK(): string {
        return '0x' + this.privateKey.toString('hex')
    }

    sendTransaction(tx: TransactionRequest): Promise<TransactionResponse> {
        // priority is 0 to avoid - InvalidPriorityFee(): 0x8c331638,
        return this.signer.sendTransaction({...tx, maxPriorityFeePerGas: 0})
    }

    signFusionOrder(order: FusionOrder): string {
        return signTypedData({
            privateKey: this.privateKey,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            data: order.getTypedData(NetworkEnum.ETHEREUM),
            version: SignTypedDataVersion.V4
        })
    }

    async getSigner(): Promise<Signer> {
        return ethers.provider.getSigner(this.address)
    }

    async donorToken(symbol: string, amount: bigint): Promise<void> {
        const donors: Record<string, string> = {
            DAI: '0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503',
            USDT: '0x5041ed759Dd4aFc3a72b8192C143F72f4724081A',
            USDC: '0x5041ed759Dd4aFc3a72b8192C143F72f4724081A',
            WETH: '0x8EB8a3b98659Cce290402893d0123abb75E3ab28',
            '1INCH': '0xF977814e90dA44bFA03b6295A0616a897441aceC'
        }

        const tokenAddress = TOKENS[symbol]

        if (!tokenAddress) {
            throw new Error(`need to add ${symbol} address`)
        }

        const donor = donors[symbol]

        if (!donor) {
            throw new Error(`need to update donor for ${symbol} token`)
        }

        await ethers.provider.send('hardhat_impersonateAccount', [donor])
        const tmpSigner = await ethers.provider.getSigner(donor)

        await transfer(tmpSigner, tokenAddress, this.address, amount)
    }

    async unlimitedApprove(symbol: string, spender: string): Promise<void> {
        return this.approve(TOKENS[symbol], spender, UNLIMITED_AMOUNT)
    }

    async approve(
        tokenAddress: string,
        spender: string,
        amount: string
    ): Promise<void> {
        return approve(this.signer, tokenAddress, spender, amount)
    }

    async getPermitNonce(
        tokenSymbol: string,
        spender: string
    ): Promise<bigint> {
        return getPermitNonce(TOKENS[tokenSymbol], spender)
    }

    async balance(symbol: string): Promise<bigint> {
        return balanceOf(TOKENS[symbol], this.address)
    }
}
