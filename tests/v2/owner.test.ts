import { describe, expect, it } from "@jest/globals";
import { PrivateKey, PublicKey, fetchAccount, UInt64, Mina } from "o1js";

import { MinaNFT } from "../../src/minanft";
import { NameContractV2, NFTContractV2 } from "../../src/contract-v2/nft";
import { initBlockchain } from "../../src/mina";
import { fetchMinaAccount } from "../../src";
import config from "../../src/config";
const { MINANFT_NAME_SERVICE_V2, NAMES_ORACLE } = config;
import { blockchain } from "../../src";

const chain: blockchain = "devnet" as blockchain;
const useLocalBlockchain: boolean = chain === "local";

beforeAll(async () => {
  const data = await initBlockchain(chain);
  expect(data).toBeDefined();
  if (data === undefined) return;
  console.log("id", Mina.getNetworkId());
});

describe(`Owner test`, () => {
  it(`should print the owner`, async () => {
    const zkAppAddress = PublicKey.fromBase58(MINANFT_NAME_SERVICE_V2);
    const zkApp = new NameContractV2(zkAppAddress);
    const tokenId = zkApp.deriveTokenId();
    const sender = PublicKey.fromBase58(
      "B62qo69VLUPMXEC6AFWRgjdTEGsA3xKvqeU5CgYm3jAbBJL7dTvaQkv"
    );
    const address = PublicKey.fromBase58(
      "B62qpjRxX55Y3eV7Pm7wJQX1sYLnPJHFaTrrJTjmBZxmaAG3g2zVbLr"
    );
    console.log("sender", sender.toBase58());
    console.log("zkAppAddress", zkAppAddress.toBase58());
    console.log("address", address.toBase58());
    console.log("tokenId", tokenId.toJSON());
    await fetchMinaAccount({ publicKey: sender });
    await fetchMinaAccount({ publicKey: zkAppAddress });
    await fetchMinaAccount({ publicKey: address, tokenId });

    const nft = new NFTContractV2(address, tokenId);
    const nftOwner = nft.owner.get();
    console.log("nftOwner", nftOwner);
    console.log("x", nftOwner.x);
    console.log("x1", nftOwner.x.toJSON());
    console.log("NFT owner", nftOwner.toBase58());
  });
});
