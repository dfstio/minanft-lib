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
  console.log(
    "Compiling the contracts, free memory: ",
    os.freemem() / 1024 / 1024 / 1024
  );
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
    nft.update("hasMinaNavigatorsBadge", "string", "true");
    nft.updateField("numberOfCommits", "number", Field(12));
    nft.updateField("MinaNavigatorsBadgeHash", "number", badgeHash);

    const disclosure = new RedactedMinaNFT(nft);
    disclosure.copyMetadata("hasMinaNavigatorsBadge");
    disclosure.copyMetadata("numberOfCommits");
    disclosure.copyMetadata("MinaNavigatorsBadgeHash");
    console.log(
      "Generating the proof, free memory: ",
      os.freemem() / 1024 / 1024 / 1024
    );
    console.time("proof");
    const proof = await disclosure.proof();
    console.timeEnd("proof");
    console.log("Free memory: ", os.freemem() / 1024 / 1024 / 1024);
    /*
    console.log(
      "Disclosure proof",
      disclosureProof.publicInput.count.toJSON(),
      disclosureProof.publicInput.hash.toJSON(),
      disclosureProof.publicInput.originalRoot.toJSON(),
      disclosureProof.publicInput.redactedRoot.toJSON()
    );
    */
    expect(proof.publicInput.count.toJSON()).toBe(Field(3).toJSON());

    const hash1 = Poseidon.hash([
      MinaNFT.stringToField("hasMinaNavigatorsBadge"),
      MinaNFT.stringToField("true"),
      MinaNFT.stringToField("string"),
    ]);
    const hash2 = Poseidon.hash([
      MinaNFT.stringToField("numberOfCommits"),
      Field(12),
      MinaNFT.stringToField("number"),
    ]);
    expect(badgeHash).not.toBeUndefined();
    if (badgeHash === undefined) return;
    const hash3 = Poseidon.hash([
      MinaNFT.stringToField("MinaNavigatorsBadgeHash"),
      badgeHash,
      MinaNFT.stringToField("number"),
    ]);
    const hash = Poseidon.hash([Poseidon.hash([hash1, hash2]), hash3]);
    expect(proof.publicInput.hash.toJSON()).toBe(hash.toJSON());

    await fs.writeFile("proof.json", JSON.stringify({ proof: proof.toJSON() }));
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
