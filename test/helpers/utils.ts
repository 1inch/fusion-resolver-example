import {ethers} from 'hardhat'
import { parseUnits } from 'ethers';

export async function getChainId(): Promise<bigint> {
    return (await ethers.provider.getNetwork()).chainId
}

export function parseAmount(amount: string, decimals = 18): bigint {
    return parseUnits(amount, decimals)
}

export function nowSec(): bigint {
    return BigInt(Math.floor(Date.now() / 1000))
}

export function randomBigInt(max = 1000): bigint {
    return BigInt(Math.floor(Math.random() * max))
}
