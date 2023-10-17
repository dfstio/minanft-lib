import { describe, expect, it } from "@jest/globals";
import { MinaNFT } from "../src/minanft";
import { Mina } from "o1js";

beforeAll(() => {
  MinaNFT.minaInit();
});

describe("MinaNFT class", () => {
  it("should create MinaNFT class instance", async () => {
    const nft = new MinaNFT("@test"); //, PublicKey.fromBase58(NFT_ADDRESS))
    nft.publicData.set("description", MinaNFT.stringToField("my nft @test"));
    nft.publicData.set("image", MinaNFT.stringToField("ipfs:Qm..."));
    const data = await nft.getPublicMapRootAndMap();
    expect(data).not.toBe(undefined);
    if (data === undefined) return;
    const { root } = data;
    expect(root.toJSON()).toBe(
      "5895890148231822126701486938886360559288862152317716797057674584801775694501"
    );
  });

  it("should create MinaNFT another class instance", async () => {
    const nft = new MinaNFT("@test"); //, PublicKey.fromBase58(NFT_ADDRESS))
    nft.publicData.set("description", MinaNFT.stringToField("my nft @test"));
    nft.publicData.set("image", MinaNFT.stringToField("ipfs:Qm1..."));
    const data = await nft.getPublicMapRootAndMap();
    expect(data).not.toBe(undefined);
    if (data === undefined) return;
    const { root } = data;
    expect(root.toJSON()).not.toBe(
      "5895890148231822126701486938886360559288862152317716797057674584801775694501"
    );
  });
});
