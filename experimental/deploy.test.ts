import { describe, expect, it } from "@jest/globals";
import os from "os";
import fs from "fs/promises";
import {
  Field,
  fetchAccount,
  PrivateKey,
  Mina,
  PublicKey,
  UInt64,
  Poseidon,
  SmartContract,
  state,
  State,
  method,
} from "o1js";
import { MINAURL } from "../src/config.json";
import { DEPLOYER } from "../env.json";
import { MinaNFT } from "../src/minanft";

jest.setTimeout(1000 * 60 * 60); // 1 hour

let deployer: PrivateKey | undefined = undefined;
const useLocal: boolean = false;

class Key extends SmartContract {
  @state(Field) key = State<Field>();

  @method mint(key: Field) {
    this.key.assertEquals(Field(0));
    this.key.set(key);
  }
}

beforeAll(async () => {
  if (useLocal) {
    const Local = await Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);
    const { privateKey } = Local.testAccounts[0];
    deployer = privateKey;
  } else {
    const network = Mina.Network(MINAURL);
    Mina.setActiveInstance(network);
    deployer = PrivateKey.fromBase58(DEPLOYER);
  }
  const balanceDeployer =
    Number((await accountBalance(deployer.toPublicKey())).toBigInt()) / 1e9;
  console.log(
    "Balance of the Deployer is ",
    balanceDeployer.toLocaleString("en")
  );
  expect(balanceDeployer).toBeGreaterThan(2);
  if (balanceDeployer <= 2) return;
  console.log(
    "Compiling the contracts, free memory: ",
    os.freemem() / 1024 / 1024 / 1024
  );
  await Key.compile();
  console.time("compiled");
  await MinaNFT.compile();
  console.timeEnd("compiled");
});

describe("MinaNFT deployment", () => {
  it("should deploy MinaNFT", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;

    const builderName = "@builder";
    const grantorSecret: Field = Field(123);
    const builderSecret: PrivateKey = PrivateKey.random();
    const pwdHash: Field = Poseidon.hash(
      builderSecret.toPublicKey().toFields()
    );
    const badgeHash = Poseidon.hash([
      grantorSecret,
      MinaNFT.stringToField(builderName),
    ]);

    const nft = new MinaNFT(builderName);
    nft.update("description", "string", "Mina Navigators Builder");
    nft.update("project", "string", "Mina zk toolkit");
    nft.update("twitter", "string", "@builder");
    nft.update("hasMinaNavigatorsBadge", "string", "true");
    nft.updateField("numberOfCommits", "number", Field(12));
    nft.updateField("MinaNavigatorsBadgeHash", "number", badgeHash);
    console.log(
      "Minting NFT, free memory: ",
      os.freemem() / 1024 / 1024 / 1024
    );
    await nft.mint(deployer, pwdHash);
    console.log("Minted NFT, free memory: ", os.freemem() / 1024 / 1024 / 1024);

    await fs.writeFile(
      "nft.json",
      JSON.stringify({
        nft: nft.zkAppPublicKey?.toJSON(),
        key: builderSecret.toBase58(),
      })
    );
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
