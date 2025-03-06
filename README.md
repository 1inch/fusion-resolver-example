# Fusion Resolver example
In this repo you'll find an example of Resolver contract and some useful tests that show you how to execute orders with [FusionSDK](https://github.com/1inch/fusion-sdk)
```
Important Notice: This code is provided as an example only and is not audited for security.
Deploying this code without an independent security review may lead to financial loss.
1inch takes no responsibility for any damages, hacks, or security vulnerabilities arising from its use.
```

All tests are working on mainnet fork with real [Settlement](https://etherscan.io/address/0x8273f37417Da37c4A6c3995E82Cf442f87a25D9c) and [1inchRouterV6](https://etherscan.io/address/0x111111125421ca6dc452d289314280a0f8842a65) contracts

## Installation
```
yarn
``` 

## Run Tests
```
NODE_URL=https://pass-eth-node-url-here.com yarn test
```

If you want to run test which uses 1inch API, you should provide dev token as `ONE_INCH_API_KEY` param. It can be retrieved at https://portal.1inch.dev/dashboard

## Examples
- [Contract example](./contracts/ResolverExample.sol)
- [Settle orders examples](./test/Settlement.ts)

