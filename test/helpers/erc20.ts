import {BigNumber, Contract, Signer} from 'ethers'
import {ethers} from 'hardhat'
import ERC20ABI from '../abi/ERC20.abi.json'
import {UNLIMITED_AMOUNT} from './constants'

export async function approve(
    signer: Signer,
    tokenAddress: string,
    approvedAddress: string,
    amount: string
): Promise<void> {
    const contract = new ethers.Contract(tokenAddress, ERC20ABI, signer)
    await contract.approve(approvedAddress, amount)
}

export async function transfer(
    signer: Signer,
    tokenAddress: string,
    destAddress: string,
    amount: string
): Promise<void> {
    const contract = new ethers.Contract(tokenAddress, ERC20ABI, signer)
    await contract.transfer(destAddress, amount)
}

export async function balanceOf(
    token: string,
    address: string
): Promise<BigNumber> {
    const contract = new Contract(token, ERC20ABI, ethers.provider)

    return contract.balanceOf(address)
}

export async function tokenName(token: string): Promise<string> {
    const contract = new Contract(token, ERC20ABI, ethers.provider)

    return contract.name()
}

export function encodeInfinityApprove(spender: string): string {
    return (
        '0x095ea7b3' +
        spender.substring(2).padStart(64, '0') +
        BigNumber.from(UNLIMITED_AMOUNT)
            .toHexString()
            .substring(2)
            .padStart(64, '0')
    )
}
