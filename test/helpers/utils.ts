import {ethers} from 'hardhat'
import {parseUnits} from 'ethers/lib/utils'

export async function getChainId(): Promise<number> {
    return (await ethers.provider.getNetwork()).chainId
}

export function parseAmount(amount: string, decimals = 18): string {
    return parseUnits(amount, decimals).toString()
}

export function nowSec(): number {
    return Math.floor(Date.now() / 1000)
}
