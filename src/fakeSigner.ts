import { EthereumProvider, IEthereumProvider, NetworkConfig } from "@nomiclabs/buidler/types";
import { Signer } from "ethers";
import { TransactionRequest, TransactionResponse } from "ethers/providers";
import { createFakeProvider } from "@nomiclabs/buidler/internal/core/providers/fake";

export class FakeSigner extends Signer {
  public impersonated: boolean = false;
  public provider: any;
  constructor(public readonly address: string, provider: any) {
    super();
    const networkName: string = 'develop';
    const networkConfig: NetworkConfig = {
      url: "http://localhost:8545",
      accounts: [address],
      gas: 5500000,
      gasPrice: 100000000000
    };
    this.provider = createFakeProvider(networkName, networkConfig)
    this.provider.resolveName = async (addr) => addr;

    // console.log(provider);
    // this.provider = provider;
  }

  public async impersonate(): Promise<boolean> {
    try {
      this.impersonated = await (this
        .provider as EthereumProvider).send("buidler_impersonateAccount", [
          this.address
        ]);
    } catch (error) {
      console.error("provider does not support impersonation");
      this.impersonated = false;
    }

    return this.impersonated;
  }

  public async getAddress(): Promise<string> {
    return this.address;
  }

  public signMessage(message: any): Promise<string> {
    throw new Error("Fake signer can't sign messages");
  }

  public async sendTransaction(
    transaction: TransactionRequest
  ): Promise<TransactionResponse> {
    const params: any = {
      from: transaction.from === undefined ? this.address : transaction.from,
      to: transaction.to,
      gas: transaction.gasLimit,
      gasPrice: transaction.gasPrice,
      data: transaction.data,
      nonce: transaction.nonce
    };
    // console.log(transaction)
    const txHash = await (this
      .provider as EthereumProvider).send("eth_sendTransaction", [params]);
    const tx = await (this
      .provider as EthereumProvider).send("eth_getTransactionByHash", [txHash]);

    // This is needed by ethers' ContractFactory deploy feature.
    tx.wait = async () => {
      // no need to wait for anything.
    };

    return tx;
  }
}
