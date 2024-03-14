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
        const req = `${this.config.url}/swap/v6.0/${this.config.network}/swap`

        const {data} = await axios.get(req, {
            headers: {
                Authorization: `Bearer ${this.config.token}`
            },
            params: {
                src: params.fromToken,
                dst: params.toToken,
                amount: params.amount,
                from: params.fromAddress,
                slippage: params.slippage,
                protocols: params.protocols?.length
                    ? params.protocols.join(',')
                    : undefined,
                disableEstimate: !!params.disableEstimate
            }
        })

        return data
    }
}
