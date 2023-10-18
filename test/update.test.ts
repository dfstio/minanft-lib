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
  await MinaNFT.compile();
});

describe("MinaNFT contract", () => {
  it("should mint and update MinaNFT NFT on local blockchain", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;

    const nft = new MinaNFT("@test"); //, PublicKey.fromBase58(NFT_ADDRESS))
    nft.updatePublicAttribute(
      "description",
      MinaNFT.stringToField("my nft @test")
    );
    nft.updatePublicAttribute("image", MinaNFT.stringToField("ipfs:Qm..."));
    const secret: Field = Field.random();
    const pwdHash: Field = Poseidon.hash([secret]);

    await nft.mint(deployer, pwdHash);

    // update public data
    nft.updatePublicAttribute(
      "twitter",
      MinaNFT.stringToField("@mytwittername")
    );
    nft.updatePublicAttribute(
      "discord",
      MinaNFT.stringToField("@mydiscordname")
    );
    nft.updatePublicAttribute(
      "linkedin",
      MinaNFT.stringToField("@mylinkedinname")
    );

    // update private data
    nft.updatePrivateAttribute(
      "secret key 1",
      MinaNFT.stringToField("secret value 1")
    );
    nft.updatePrivateAttribute(
      "secret key 2",
      MinaNFT.stringToField("secret value 2")
    );
    nft.updatePrivateAttribute(
      "secret key 3",
      MinaNFT.stringToField("secret value 3")
    );

    await nft.commit(deployer, secret); // commit the update to blockchain

    const newSecret: Field = Field.random();
    await nft.changePassword(deployer, secret, newSecret);
  });
});
