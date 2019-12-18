[![buidler](https://buidler.dev/buidler-plugin-badge.svg?1)](https://buidler.dev)
# buidler-erasure

Buidler plugin for Erasure protocol

## What

This plugin helps you deploy the erasure protocol contracts.

## Tasks

This plugin adds the following tasks to Buidler:

- `erasure:erasure-setup`: Deploys all the erasure contracts

## Environment extensions

This plugin extends the Buidler Runtime Environment by adding the following:
	
- `getErasureSetup`: retrieves erasure deploy setup.
- `getDeployedAddresses`: retrieves the deployed addresses of a given contract name.
- `getDeployedContracts`: retrieves the deployed contract instances of a given contract name.
- `saveDeployedContract`: store a contract's address into the deployment state.
- `deploy`: deploys a contract
- `deployContract`: resolves what kind of contract it's being deployed and deploy it.
- `getContractInstance`: retrieves an instance of a contract attached to an address
- `createInstance`: creates a template instance from a factory


## Configuration

You can configure how your erasure contracts are deployed.

There are some examples of different configurations [here](https://github.com/itirabasso/erasure-protocol/blob/master/config)

By default, it uses the [default setup](https://github.com/itirabasso/buidler-erasure/blob/master/src/defaultSetup.ts#L17) which deploy the contracts as they are now.

## Usage

You can use buidler-erasure along with erasure-protocol to deploy your contracts and run scripts, buidler-erasure tasks, or any custom tasks.

This plugin is still under development, so in order to use it you must build and link the dependencies onto your project.

Here is what it takes to install it on the erasure-protocol project, this bash snippet is to install my `erasureprotocol/erasure-protocol` fork, which includes a little script that simulates the packages/testenv

```bash
git clone git@github.com:itirabasso/buidler.git
git clone git@github.com:itirabasso/buidler-erasure.git
git clone git@github.com:itirabasso/erasure-protocol.git

cd buidler
scripts/install.sh # install buidler 
npm run watch # build and watch for changes.

# new tab

cd packages/buidler-core
npm link # link buidler-core to introduce changes on Buidler EVM

cd ../../../buidler-erasure
npm i
npm link @nomiclabs/buidler # link local buidler 
npm link 
npm run watch

# new tab

cd ../erasure-protocol
npm i
npm link @nomiclabs/buidler
npm link buidler-erasure
npx buidler # this should display the avaiable commands
npx buidler run script.js
```

After these changes are merged into buidler and I publish this plugin npm this process should be as simple as install any other dependency.

## Further development

I'm currently working on a FakeProvider to allow buidler-erasure to deploy on local networks (like ganache) with a fake tx (impersonating the NMR signer).
After that, and merging these features on buidler it'll be much easier to install the project.