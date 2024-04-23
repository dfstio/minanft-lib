import { describe, expect, it } from "@jest/globals";
import { Mina, Field, Poseidon, PrivateKey, UInt32 } from "o1js";
import { MinaNFT } from "../src/minanft";

jest.setTimeout(1000 * 60 * 60); // 1 hour

let deployer: PrivateKey | undefined = undefined;

beforeAll(async () => {
  const Local = await Mina.LocalBlockchain({ proofsEnabled: true });
  Mina.setActiveInstance(Local);
  const { privateKey } = Local.testAccounts[0];
  deployer = privateKey;
});

describe("MinaNFT contract", () => {
  it("should mint and update MinaNFT NFT", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;

    let min: UInt32 = UInt32.from(2 ** 32 - 1);
    let max: UInt32 = UInt32.from(0);
    for (let i = 0; i < 200; i++) {
      const x: UInt32 = UInt32.from(Field.random().rangeCheckHelper(32))
        .mod(UInt32.from(10))
        .add(UInt32.from(1));
      if (x.lessThan(min).toBoolean()) min = x;
      if (x.greaterThan(max).toBoolean()) max = x;
    }

    console.log(min.toBigint());
    console.log(max.toBigint());
    /*
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
    */
  });
});
