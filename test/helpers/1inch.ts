import {
    OneInchApiConfig,
    OneInchApiSwapResponse,
    OneInchSwapParams
} from './types'
import axios from 'axios'

export class OneInchApi {
    constructor(private readonly config: OneInchApiConfig) {}

    async requestSwapData(
        params: OneInchSwapParams
    ): Promise<OneInchApiSwapResponse> {
        const req =
            `${this.config.url}/v5.0/${this.config.network}` +
            `/swap?fromTokenAddress=${params.fromToken}&toTokenAddress=${params.toToken}` +
            `&amount=${params.amount}&fromAddress=${params.fromAddress}` +
            `&slippage=${params.slippage}` +
            `${
                params.protocols
                    ? '&protocols=' + params.protocols.join(',')
                    : ''
            }` +
            `&disableEstimate=${!!params.disableEstimate}`

        return axios.get(req).then((x) => x.data)
    }
}
