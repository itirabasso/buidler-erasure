[![buidler](https://buidler.dev/buidler-plugin-badge.svg?1)](https://buidler.dev)
# buidler-erasure

Buidler plugin for Erasure protocol

## What

<_A longer, one paragraph, description of the plugin_>

This plugin will help you with world domination by implementing a simple tic-tac-toe in the terminal.

## Installation

<_A step-by-step guide on how to install the plugin_>



```bash
npm install erasure-buidler ethers github:erasureprotocol/erasure-protocol#master
```
And add the following statement to your `buidler.config.js`:

```js
usePlugin("buidler-erasure");
```

## Required plugins

<_The list of all the required Buidler plugins if there are any_>

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
    getContractInstance(
      name: string,
      address: string,
      account: string | Signer
    ): Contract;
  }
```

- `deploySetup`: defines the nmr token, registries and factories of your erasure setup.
- `getDeployedAddresses`: a function that retrieves the addresses of a given contract name.
- `getDeployedContracts`: a function that retrieves the contracts of a given contract name.
- `saveDeployedContract`: store a contract's address into the deployment state.
- `getContractInstance`: retrieves an instance of a contract attached to an address


## Configuration

<_A description of each extension to the BuidlerConfig or to its fields_>

This plugin extends the `BuidlerConfig`'s `ProjectPaths` object with an optional 
`newPath` field.

This is an example of how to set it:

```js
module.exports = {
  paths: {
    newPath: "./new-path"
  }
};
```

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


## TypeScript support

<_This section is needed if you are extending types in your plugin_>

You need to add this to your `tsconfig.json`'s `files` array: 
`"node_modules/<npm package name>/src/type-extensions.d.ts"`
