import {ethers} from 'hardhat'
import ERC20ABI from '../abi/ERC20.abi.json'
import {BigNumber} from 'ethers'
import {PermitParams} from './types'
import {EthersPrivateKeyProviderConnector} from './ethers-provider.connector'
import {Eip2612PermitUtils} from '@1inch/permit-signed-approvals-utils'
import {PERMIT_VERSION_V2_TOKENS} from './constants'

export function getPermitNonce(
    tokenAddress: string,
    spender: string
): Promise<BigNumber> {
    const contract = new ethers.Contract(
        tokenAddress,
        ERC20ABI,
        ethers.provider
    )

    return contract.nonces(spender)
}

export async function buildDaiLikePermit(
    params: PermitParams
): Promise<string> {
    const connector = new EthersPrivateKeyProviderConnector(
        params.userPrivateKey
    )
    const eip2612PermitUtils = new Eip2612PermitUtils(connector, {
        enabledCheckSalt: true
    })

    return eip2612PermitUtils.buildDaiLikePermitCallData(
        {
            holder: ethers.utils.computeAddress(params.userPrivateKey),
            spender: params.spender,
            value: params.value,
            nonce: params.nonce,
            expiry: Math.ceil(Date.now() / 1000) + 50_000,
            allowed: true
        },
        params.chainId,
        params.tokenName,
        params.tokenAddress
    )
}

export async function buildPermit(params: PermitParams): Promise<string> {
    const connector = new EthersPrivateKeyProviderConnector(
        params.userPrivateKey
    )
    const eip2612PermitUtils = new Eip2612PermitUtils(connector, {
        enabledCheckSalt: true
    })

    return eip2612PermitUtils.buildPermitCallData(
        {
            owner: ethers.utils.computeAddress(params.userPrivateKey),
            spender: params.spender,
            value: params.value,
            nonce: params.nonce,
            deadline: Math.ceil(Date.now() / 1000) + 50_000
        },
        params.chainId,
        params.tokenName,
        params.tokenAddress,
        getPermitVersion(params.tokenAddress)
    )
}

function getPermitVersion(tokenAddress: string): string {
    if (PERMIT_VERSION_V2_TOKENS.includes(tokenAddress.toLowerCase())) {
        return '2'
    }

    return '1'
}
