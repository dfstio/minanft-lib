import { describe, expect, it } from "@jest/globals";
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
import { MinaNFT, RedactedMinaNFT } from "../src/minanft";
import { RedactedMinaNFTMapCalculation } from "../src/plugins/redactedmap";

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
    const Local = Mina.LocalBlockchain({ proofsEnabled: true });
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
  await Key.compile();
  console.time("compiled");
  console.log("Compiling RedactedMinaNFTMapCalculation");
  await MinaNFT.compileRedactedMap();
  //await RedactedMinaNFTMapCalculation.compile();
  console.timeEnd("compiled");
});

describe("Create a proof of a redacted MinNFT", () => {
  it("should generate a proof", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;

    const builderName = "@builder";
    const grantorSecret: Field = Field(123);
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

    const disclosure = new RedactedMinaNFT(nft);
    disclosure.copyMetadata("twitter");

    console.time("proof");
    const proof = await disclosure.proof();
    console.timeEnd("proof");

    expect(proof.publicInput.count.toJSON()).toBe(Field(1).toJSON());
    await fs.writeFile(
      "badgeproof.json",
      JSON.stringify({ proof: proof.toJSON() })
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
