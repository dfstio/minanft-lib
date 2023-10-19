import { describe, expect, it } from "@jest/globals";
import { MinaNFT } from "../src/minanft";
import { IPFS } from "../src/storage/ipfs";

import { PINATA_JWT } from "../env.json";

beforeAll(() => {
  MinaNFT.minaInit();
});

describe("IPFS", () => {
  it("should pin MinaNFT URI to IPFS", async () => {
    const nft = new MinaNFT("@test"); //, PublicKey.fromBase58(NFT_ADDRESS))
    nft.updatePublicAttribute(
      "description",
      MinaNFT.stringToField("my nft @test")
    );
    nft.updatePublicAttribute("image", MinaNFT.stringToField("ipfs:Qm..."));
    nft.updatePublicAttribute(
      "description",
      MinaNFT.stringToField("my nft @test")
    );

    const json = await nft.getPublicJson();
    expect(json).not.toBe(undefined);
    if (json === undefined) return;
    console.log("NFT URI: ", JSON.stringify(json, null, 4));

    const ipfs = new IPFS(PINATA_JWT);
    const hash = await ipfs.pinJSON(json);
    expect(hash).not.toBe(undefined);
    if (hash === undefined) return;
    console.log(`NFT URI pinned to https://ipfs.io/ipfs/${hash}`);
  });
});
