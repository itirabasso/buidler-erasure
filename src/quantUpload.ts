import { BuidlerContext } from "@nomiclabs/buidler/internal/context";
import { BuidlerRuntimeEnvironment } from "@nomiclabs/buidler/types";
import { pinJSONToIPFS } from "@pinata/sdk";
import { get, post } from "axios";
import { decode, encode } from "ethereumjs-abi";
import { Contract, Signer } from "ethers";
import { base64, BigNumber } from "ethers/utils";
import { cat } from "ipfs-mini";
import { of } from "ipfs-only-hash";
import { fromB58String, toHexString } from "multihashes";

import { asymmetric, ipfs, symmetric } from "./helper";

const { erasure } = BuidlerContext.getBuidlerContext()
  .environment as BuidlerRuntimeEnvironment;

export async function baySell(
  seller: Signer,
  fileBuffer: Buffer,
  description: string,
  price: number,
  stake: number,
  escrowCountdown: number | BigNumber,
  griefType: string,
  griefRatio: number,
  agreementCountdown: number
): Promise<any> {
  // Promise<Contract> throws an error
  const account = await seller.getAddress();

  const [msg, sig, salt] = await getSalt(seller);

  const keypair = asymmetric.generateKeyPair(sig, salt);
  const nonce = asymmetric.generateNonce();
  const symmetricKey = symmetric.generateKey();
  const fileEncoded = base64.encode(fileBuffer);
  const proofHash = await ipfs.onlyHash(fileBuffer);
  const proofHashHex = ipfs.hashToHex(proofHash);

  const encryptedFile = symmetric.encryptMessage(symmetricKey, fileEncoded);
  const encryptedFileIpfsPath = await pinJSONToIPFS({
    content: encryptedFile
  });
  const encryptedSymmetricKey = asymmetric.secretBox.encryptMessage(
    symmetricKey,
    nonce,
    keypair.secretKey
  );

  const metadataObj = {
    nonce,
    description,
    erasureBay: "0.0.1",
    proofHash: proofHashHex,
    encryptedSymmetricKey,
    encryptedFileIpfsPath
  };
  const metadataJsonIpfsPath = await pinJSONToIPFS(metadataObj);

  const metadataHex = ipfs.hashToHex(metadataJsonIpfsPath);

  griefRatio = griefType === "ratio" ? griefRatio : 0;
  const griefCountdown = agreementCountdown * 86400;
  const agreementParams = encode(
    ["uint120", "uint8", "uint128"],
    [griefRatio, griefType, griefCountdown]
  );

  const values = [
    account,
    "0x0000000000000000000000000000000000000000",
    account,
    price,
    stake,
    escrowCountdown,
    metadataHex,
    agreementParams
  ];
  const agreement = await erasure.createInstance(
    "CountdownGriefingEscrow",
    values
  );
  return agreement;
}

export async function revealSubmission(
  lastPost: any,
  message: string,
  signature: string,
  keypair: any
): Promise<any> {
  const {
    encryptedSymmetricKey,
    encryptedFileIpfsPath,
    nonce
  } = lastPost.static_metadata;

  const newEncryptedSymmetricKey = new Uint8Array(
    Object.keys(encryptedSymmetricKey).length
  );
  const keyIndices = Object.keys(encryptedSymmetricKey);
  for (const index of keyIndices) {
    newEncryptedSymmetricKey[index] = encryptedSymmetricKey[index];
  }
  const newNonce = new Uint8Array(24);
  const nonceIndices = Object.keys(nonce);
  for (const index of nonceIndices) {
    newNonce[index] = nonce[index];
  }
  const decryptedSymmetricKey = asymmetric.secretBox.decryptMessage(
    newEncryptedSymmetricKey,
    newNonce,
    keypair.secretKey
  );
  const encryptedFile = await cat(encryptedFileIpfsPath);
  const decryptedFile = symmetric.decryptMessage(
    decryptedSymmetricKey,
    encryptedFile
  );
  const revealedPath = await pinJSONToIPFS({
    message,
    signature,
    file: decryptedFile
  });

  const revealUrl = `${process.env.API_URL}/posts/reveal`;
  const data = {
    message,
    signature,
    instance: lastPost.pk
  };
  const response = await post(revealUrl, data);
  // }
}

export async function getSalt(
  signer: Signer
): Promise<[string, string, string]> {
  const account = await signer.getAddress();
  const msg =
    "I am signing this message to generate my ErasureQuant keypair as " +
    account;
  const sig = await signer.signMessage(msg); // missing third "" param
  const apiUrl = `${process.env.API_URL}/users/auth/${account}/${msg}/${sig}`;
  const response = await get(apiUrl);
  const salt = response.data[0].fields.salt;
  return [msg, sig, salt];
}

export async function quantUpload(
  signer: Signer,
  file: Blob,
  userAgreement: any
): Promise<any> {
  const account = await signer.getAddress();
  const [msg, sig, salt] = await getSalt(signer);
  const keypair = asymmetric.generateKeyPair(sig, salt);

  // read the file
  const text = (file as unknown) as string;
  const buf = Buffer.from(text, "utf-8");
  const proofHash = await of(buf);
  const proofHashHex = toHexString(fromB58String(proofHash));
  const proofHashHexPrefixed = "0x" + proofHashHex;

  let symmetricKey = symmetric.generateKey();
  let encryptedFile = symmetric.encryptMessage(symmetricKey, file);
  while (
    encryptedFile.includes("null") ||
    encryptedFile.includes("undefined")
  ) {
    symmetricKey = symmetric.generateKey();
    encryptedFile = symmetric.encryptMessage(symmetricKey, text);
  }

  const nonce = asymmetric.generateNonce();
  const encryptedSymmetricKey = asymmetric.secretBox.encryptMessage(
    symmetricKey,
    nonce,
    keypair.secretKey
  );
  const encryptedFileIpfsPath = await pinJSONToIPFS({
    message: msg,
    signature: sig,
    file: encryptedFile
  });

  const metadataObj = {
    nonce,
    erasureQuantPost: "0.0.6",
    ipfsHash: proofHash,
    encryptedSymmetricKey,
    encryptedFileIpfsPath
  };
  const metadataJsonIpfsPath = await pinJSONToIPFS({
    message: msg,
    signature: sig,
    file: metadataObj
  });
  const metadataJsonIpfsPathHex = toHexString(
    fromB58String(metadataJsonIpfsPath)
  );
  const metadataJsonIpfsPathHexPrefixed = "0x" + metadataJsonIpfsPathHex;

  // const initData = encode(
  //   ["address", "bytes", "bytes", "bytes"],
  //   [
  //     account,
  //     proofHashHexPrefixed,
  //     metadataJsonIpfsPathHexPrefixed,
  //     metadataJsonIpfsPathHexPrefixed
  //   ]
  // );

  const feed = await erasure.createInstance("Feed", [
    account,
    proofHashHexPrefixed,
    metadataJsonIpfsPathHexPrefixed,
    metadataJsonIpfsPathHexPrefixed
  ]);

  if (userAgreement) {
    const postInstance = feed.address;
    const privateRevealApi = `${process.env.API_URL}/posts/reveal/private`;
    const blob = new Blob([text]);
    const data = new FormData();
    data.append("file", blob);
    data.append("message", msg);
    data.append("signature", sig);
    data.append("instance", postInstance);
    await post(privateRevealApi, data, {
      headers: {
        "Content-Type": `multipart/form-data`
      }
    });
  }
}
