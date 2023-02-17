import {BigNumber, Signer, Wallet} from 'ethers'
import {ethers} from 'hardhat'
import {TOKENS, UNLIMITED_AMOUNT} from './constants'
import {approve, balanceOf, transfer} from './erc20'
import {FusionOrder} from '@1inch/fusion-sdk'
import {signTypedData, SignTypedDataVersion} from '@metamask/eth-sig-util'
import {Deferrable} from '@ethersproject/properties'
import {
    TransactionRequest,
    TransactionResponse
} from '@ethersproject/abstract-provider'
import {getPermitNonce} from './permit'

export class User {
    public readonly address: string

    private readonly signer: Wallet

    constructor(public readonly privateKey: Buffer) {
        this.address = ethers.utils.computeAddress(privateKey)
        this.signer = new Wallet(privateKey, ethers.provider)
    }

    get PK(): string {
        return '0x' + this.privateKey.toString('hex')
    }

    sendTransaction(
        tx: Deferrable<TransactionRequest>
    ): Promise<TransactionResponse> {
        return this.signer.sendTransaction(tx)
    }

    signFusionOrder(order: FusionOrder): string {
        return signTypedData({
            privateKey: this.privateKey,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            data: order.getTypedData(),
            version: SignTypedDataVersion.V4
        })
    }

    getSigner(): Signer {
        return ethers.provider.getSigner(this.address)
    }

    async donorToken(symbol: string, amount: string): Promise<void> {
        const donors: Record<string, string> = {
            DAI: '0xf977814e90da44bfa03b6295a0616a897441acec',
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
        const tmpSigner = ethers.provider.getSigner(donor)

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
    ): Promise<BigNumber> {
        return getPermitNonce(TOKENS[tokenSymbol], spender)
    }

    async balance(symbol: string): Promise<BigNumber> {
        return balanceOf(TOKENS[symbol], this.address)
    }
}
