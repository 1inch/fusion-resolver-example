# Fusion Resolver example
In this repo you'll find an example of Resolver contract and some useful tests that show you how to execute orders with [FusionSDK](https://github.com/1inch/fusion-sdk)

All tests are working on mainnet fork with real [Settlement](https://etherscan.io/address/0xa88800cd213da5ae406ce248380802bd53b47647) and [1inchRouterV5](https://etherscan.io/address/0x1111111254eeb25477b68fb85ed929f73a960582) contracts

## Installation
```
yarn
``` 

## Run Tests
```
NODE_URL=https://pass-eth-node-url-here.com yarn test
```

## Examples
- [Contract example](./contracts/ResolverExample.sol)
- [settleOrders examples](./test/Settlement.ts)

