import {BigNumber, Contract, Signer} from 'ethers'
import {ethers} from 'hardhat'
import ERC20ABI from '../abi/ERC20.abi.json'

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
