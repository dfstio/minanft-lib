import { describe, expect, it } from "@jest/globals";
import {
  Mina,
  Field,
  Poseidon,
  PrivateKey,
  UInt64,
  PublicKey,
  fetchAccount,
} from "o1js";
import { MinaNFT } from "../src/minanft";
import { MINAURL } from "../src/config.json";
import { DEPLOYER } from "../env.json";

jest.setTimeout(1000 * 60 * 60); // 1 hour

let deployer: PrivateKey | undefined = undefined;
const useFaucet: boolean = false;

beforeAll(async () => {
  await MinaNFT.minaInit(MINAURL);
  deployer = useFaucet ? PrivateKey.random() : PrivateKey.fromBase58(DEPLOYER);
  if (useFaucet) Mina.faucet(deployer.toPublicKey());
  await MinaNFT.compile();

  if (useFaucet) {
    let waitForTopup: boolean = true;
    let count = 0;
    while (waitForTopup) {
      const balance = Number(
        (await accountBalance(deployer.toPublicKey())).toBigInt()
      );
      if (balance > 0) waitForTopup = false;
      else {
        if (count > 30) {
          console.error("The Faucet has failed to fund an account");
          waitForTopup = false;
          break;
        }
        if (count === 0)
          console.log(
            `Waiting for the funding of the deployer ${deployer
              .toPublicKey()
              .toBase58()}...`
          );
        count++;
        await sleep(60 * 1000);
      }
    }
  }

  const balanceDeployer =
    Number((await accountBalance(deployer.toPublicKey())).toBigInt()) / 1e9;
  console.log(
    "Balance of the Deployer is ",
    balanceDeployer.toLocaleString("en")
  );
  expect(balanceDeployer).toBeGreaterThan(2);
  if (balanceDeployer <= 2) return;
});

describe("MinaNFT contract on Berkeley", () => {
  it("should mint and update MinaNFT NFT on Berkeley network", async () => {
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

async function accountBalance(address: PublicKey): Promise<UInt64> {
  let check = Mina.hasAccount(address);
  if (!check) {
    await fetchAccount({ publicKey: address });
    check = Mina.hasAccount(address);
    if (!check) return UInt64.from(0);
  }
  const balance = Mina.getBalance(address);
  return balance;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
