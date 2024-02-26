import {ethers} from 'hardhat'
import {parseUnits} from 'ethers/lib/utils'

export async function getChainId(): Promise<number> {
    return (await ethers.provider.getNetwork()).chainId
}

export function parseAmount(amount: string, decimals = 18): bigint {
    return parseUnits(amount, decimals).toBigInt()
}

export function nowSec(): bigint {
    return BigInt(Math.floor(Date.now() / 1000))
}
