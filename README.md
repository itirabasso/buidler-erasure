[![buidler](https://buidler.dev/buidler-plugin-badge.svg?1)](https://buidler.dev)
# buidler-erasure

Buidler plugin for Erasure protocol

## What

This plugin will help you integrate your dapp with the erasure protocol by letting you easily invoke erasure's contracts and interact with them.

## Installation

This plugin relies on the smart contracts of the erasure protocol.

```bash
npm install buidler-erasure ethers github:erasureprotocol/erasure-protocol#master
```
And add the following statement to your `buidler.config.js`:

```js
usePlugin("buidler-erasure");
```

## Required plugins

- [@nomiclabs/buidler-ethers](https://github.com/nomiclabs/buidler/tree/master/packages/buidler-ethers)

## Tasks


This plugin adds the following tasks to Buidler:

- `erasure:deploy-full`: Deploy the whole platform
- `erasure:create-instance`: Creates a new instance from a factory
- `erasure:create-agreement`:	Creates an Simple Agreement
- `erasure:stake`: Stake NMR in an Simple Griefing Agreement
- `erasure:copy-contracts`: Temporal task. Copy the erasure protocol contracts into your project's sources folder.


## Environment extensions

This plugin extends the Buidler Runtime Environment by adding the following elements:

```js
  erasure: {
    deploySetup: ErasureDeploySetup;
    getDeployedAddresses(name: string): Promise<string[]>;
    getDeployedContracts(contractName: string): Promise<Contract[]>;
    saveDeployedContract(name: string, instance: any): void;
    getContractInstance(name: string, address: string, account: string | Signer): Contract;
  }
```

- `deploySetup`: defines the nmr token, registries and factories of your erasure setup.
- `getDeployedAddresses`: a function that retrieves the addresses of a given contract name.
- `getDeployedContracts`: a function that retrieves the contracts of a given contract name.
- `saveDeployedContract`: store a contract's address into the deployment state.
- `getContractInstance`: retrieves an instance of a contract attached to an address


## Configuration

There is no configuration required for this plugin.


## Usage

You must copy the erasure protocol contracts into your sources folder. You can do it manually:
```bash
cp node_modules/erasure-protocol/contracts/**/*.sol <source_folder>
```
Or use a (temporal) task I've created to do this:
```bash
npx buidler erasure:copy-contracts
```
I'm working on a solution to avoid this.
