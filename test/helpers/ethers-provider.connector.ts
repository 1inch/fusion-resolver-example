import {ethers} from 'hardhat'
import {signTypedData, SignTypedDataVersion} from '@metamask/eth-sig-util'
import {AbiInput} from 'web3-utils'
import {ProviderConnector} from '@1inch/permit-signed-approvals-utils/connector/provider.connector'
import {AbiItem} from '@1inch/permit-signed-approvals-utils/model/abi.model'
import {EIP712TypedData} from '@1inch/permit-signed-approvals-utils/model/eip712.model'
import {ParamType} from 'ethers/lib/utils'

export class EthersPrivateKeyProviderConnector implements ProviderConnector {
    private readonly privateKeyBuffer: Buffer

    constructor(
        private readonly privateKey: string,
        protected readonly provider = ethers.provider
    ) {
        this.privateKeyBuffer = Buffer.from(privateKey.replace('0x', ''), 'hex')
    }

    signTypedData(
        _walletAddress: string,
        typedData: EIP712TypedData,
        _typedDataHash: string
    ): Promise<string> {
        const result = signTypedData({
            privateKey: this.privateKeyBuffer,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            data: typedData,
            version: SignTypedDataVersion.V4
        })

        return Promise.resolve(result)
    }

    ethCall(contractAddress: string, callData: string): Promise<string> {
        return this.provider.call({
            to: contractAddress,
            data: callData
        })
    }

    contractEncodeABI(
        abi: AbiItem[],
        address: string | null,
        methodName: string,
        methodParams: unknown[]
    ): string {
        const iface = new ethers.utils.Interface(abi)

        return iface.encodeFunctionData(methodName, methodParams)
    }

    decodeABIParameter<T>(type: string, hex: string): T {
        return ethers.utils.defaultAbiCoder.decode([type], hex)[0] as T
    }

    decodeABIParameters<T>(types: AbiInput[], hex: string): T {
        return ethers.utils.defaultAbiCoder.decode(
            types.map((x) => ParamType.from(x)),
            hex
        ) as T
    }
}
