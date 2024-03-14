import {NetworkEnum} from '@1inch/fusion-sdk'
import {ChainId} from '@1inch/permit-signed-approvals-utils'

export type OneInchSwapParams = {
    fromToken: string
    toToken: string
    amount: string
    fromAddress: string
    slippage: number
    disableEstimate?: boolean
    protocols?: string[]
}

export type OneInchApiConfig = {
    url: string
    network: NetworkEnum,
    token: string
}

export type OneInchApiSwapResponse = {
    toAmount: string
    tx: Tx
}

export type PermitParams = {
    userPrivateKey: string
    spender: string
    value: string
    nonce: number
    tokenName: string
    tokenAddress: string
    chainId: ChainId
}

export type Tx = {
    from: string
    to: string
    data: string
    value: string
    gas: number
    gasPrice: string
}
