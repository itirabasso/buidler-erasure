import { EthereumProvider } from "@nomiclabs/buidler/types";
import { Signer } from "ethers";
import { TransactionRequest, TransactionResponse } from "ethers/providers";

export class FakeSigner extends Signer {
  constructor(public readonly address: string, public readonly provider: any) {
    super();
    const canImpersonate = (this
      .provider as EthereumProvider).send("buidler_impersonateAccount", [
      address
    ]);

    if (!canImpersonate) {
      throw new Error("provider doesnt not support impersonation");
    }
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
    const txHash = await (this
      .provider as EthereumProvider).send("eth_sendFakeTransaction", [params]);
    const tx = await (this
      .provider as EthereumProvider).send("eth_getTransactionByHash", [txHash]);

    // This is needed by ethers' ContractFactory deploy feature.
    tx.wait = async () => {
      // no need to wait for anything.
    };

    return tx;
  }
}
