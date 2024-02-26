import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-waffle'
import {config as dotEnvConfig} from 'dotenv'

import 'hardhat-typechain'
import 'hardhat-jest-plugin'
import 'hardhat-tracer'
import {HardhatUserConfig} from 'hardhat/types'

dotEnvConfig()

const config: HardhatUserConfig = {
    defaultNetwork: 'hardhat',
    solidity: {
        compilers: [{version: '0.8.23', settings: {}}]
    },
    networks: {
        hardhat: {
            forking: {
                // eslint-disable-next-line
                enabled: true,
                url: process.env.NODE_URL
            },
            chainId: 1
        },
        localhost: {}
    }
}

export default config
