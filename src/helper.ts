import fernet from "fernet";
import { getRandomValues } from "get-random-values";
import { of } from "ipfs-only-hash";
import { fromB58String, toHexString } from "multihashes";
import pbkdf2 from "pbkdf2";
import tweetnacl from "tweetnacl";

// declare module "multihashes";

const MAX_UINT32 = Math.pow(2, 32) - 1;
const MAX_UINT8 = Math.pow(2, 8) - 1;
const FERNET_SECRET_LENGTH = 32;
const NONCE_LENGTH = 24;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const randomNumber = () => {
  if (typeof window === "undefined") {
    return getRandomValues(new Uint8Array(1))[0] / MAX_UINT8;
  }
  return getRandomValues(new Uint32Array(1))[0] / MAX_UINT32;
};

const randomString = () => {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < FERNET_SECRET_LENGTH; i++) {
    result += characters.charAt(Math.floor(randomNumber() * charactersLength));
  }
  return result;
};

export const ipfs = {
  hashToHex: (ipfsHash: any) => "0x" + toHexString(fromB58String(ipfsHash)),
  onlyHash: async data => {
    let buf = data;
    if (!Buffer.isBuffer(data)) {
      buf = Buffer.from(data);
    }
    const hash = await of(buf);
    return hash;
  }
};
export const symmetric = {
  generateKey: (): string => {
    let key = Buffer.from(randomString()).toString("base64");
    let secret = fernet.decode64toHex(key);
    while (secret.length !== fernet.hexBits(256)) {
      key = Buffer.from(randomString()).toString("base64");
      secret = fernet.decode64toHex(key);
    }
    return key;
  },
  encryptMessage: (secretKey, msg): string => {
    const secret = new fernet.Secret(secretKey);
    const token = new fernet.Token({ secret, ttl: 0 });
    return token.encode(msg);
  },
  decryptMessage: (secretKey, encryptedMessage) => {
    const secret = new fernet.Secret(secretKey);
    const token = new fernet.Token({
      secret,
      ttl: 0,
      token: encryptedMessage
    });
    return token.decode();
  }
};
export const asymmetric = {
  generateKeyPair: (sig, salt) =>
    tweetnacl.box.keyPair.fromSecretKey(pbkdf2.pbkdf2Sync(sig, salt, 1000, 32)),
  generateNonce: () => tweetnacl.randomBytes(NONCE_LENGTH),
  encryptMessage: (msg, nonce, publicKey, secretKey) => {
    const encodedMessage = encoder.encode(msg);
    return tweetnacl.box(encodedMessage, nonce, publicKey, secretKey);
  },
  decryptMessage: (box, nonce, publicKey, secretKey) => {
    const encodedMessage = tweetnacl.box.open(box, nonce, publicKey, secretKey);
    if (!encodedMessage) {
      throw new Error("unable to encode message");
    }
    return decoder.decode(encodedMessage);
  },
  secretBox: {
    encryptMessage: (msg, nonce, secretKey) => {
      const encodedMessage = encoder.encode(msg);
      return tweetnacl.secretbox(encodedMessage, nonce, secretKey);
    },
    decryptMessage: (box, nonce, secretKey) => {
      const encodedMessage = tweetnacl.secretbox.open(box, nonce, secretKey);
      if (!encodedMessage) {
        throw new Error("unable to encode message");
      }

      return decoder.decode(encodedMessage);
    }
  }
};
