import { describe, expect, it } from "@jest/globals";
import { Mina, Field, Poseidon, PrivateKey } from "o1js";
import { MinaNFT } from "../src/minanft";

jest.setTimeout(1000 * 60 * 60); // 1 hour

let deployer: PrivateKey | undefined = undefined;

beforeAll(async () => {
  const Local = Mina.LocalBlockchain({ proofsEnabled: true });
  Mina.setActiveInstance(Local);
  const { privateKey } = Local.testAccounts[0];
  deployer = privateKey;
});

describe("MinaNFT contract", () => {
  it("should mint and update MinaNFT NFT", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;

    const nft = new MinaNFT("@test"); //, PublicKey.fromBase58(NFT_ADDRESS))
    nft.update("description", "string", "my nft @test");
    nft.update("image", "string", "ipfs:Qm...");
    const secret: Field = Field.random();
    const owner: Field = Poseidon.hash([secret]);

    await nft.mint(deployer, owner);

    // update metadata
    nft.update("twitter", "string", "@mytwittername");
    nft.update("discord", "string", "@mydiscordname");
    nft.update("linkedin", "string", "@mylinkedinname");
    await nft.commit(deployer, secret); // commit the update to blockchain

    const newSecret: Field = Field.random();
    await nft.changePassword(deployer, secret, newSecret);
  });
});
