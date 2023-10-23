import { describe, expect, it } from "@jest/globals";
import os from "os";
import fs from "fs/promises";
import {
  Field,
  state,
  State,
  method,
  DeployArgs,
  Permissions,
  SmartContract,
  AccountUpdate,
  fetchAccount,
  PrivateKey,
  Mina,
  PublicKey,
  UInt64,
  Poseidon,
  Struct,
} from "o1js";
import { MINAURL } from "../src/config.json";
import { DEPLOYER } from "../env.json";
import { MinaNFT, RedactedMinaNFT } from "../src/minanft";

jest.setTimeout(1000 * 60 * 60); // 1 hour

let deployer: PrivateKey | undefined = undefined;
const useLocal: boolean = false;

let testnft: MinaNFT | undefined = undefined;
let badgeHash: Field | undefined = undefined;

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
  //await KeyValue.compile();
  //await MinaNFT.compile();
});

describe("Create a proof of a redacted MinNFT", () => {
  it("should deploy MinaNFT", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;

    const builderName = "@builder";
    const grantorSecret: Field = Field.random();
    const builderSecret: Field = Field.random();
    const pwdHash: Field = Poseidon.hash([builderSecret]);
    badgeHash = Poseidon.hash([
      grantorSecret,
      MinaNFT.stringToField(builderName),
    ]);

    const nft = new MinaNFT(builderName);
    nft.updatePublicAttribute(
      "description",
      MinaNFT.stringToField("Mina Navigators Builder")
    );
    nft.updatePublicAttribute("image", MinaNFT.stringToField("ipfs:Qm..."));
    nft.updatePublicAttribute(
      "project",
      MinaNFT.stringToField("Mina zk toolkit")
    );
    nft.updatePublicAttribute(
      "hasMinaNavigatorsBadge",
      MinaNFT.stringToField("true")
    );
    nft.updatePublicAttribute("numberOfCommits", Field(12));
    nft.updatePrivateAttribute("MinaNavigatorsBadgeHash", badgeHash);
    console.log(
      "Minting NFT, free memory: ",
      os.freemem() / 1024 / 1024 / 1024
    );
    await nft.mint(deployer, pwdHash);
    console.log("Minted NFT, free memory: ", os.freemem() / 1024 / 1024 / 1024);
    testnft = nft;
  });

  it("should generate a proof", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;
    expect(testnft).not.toBeUndefined();
    if (testnft === undefined) return;

    const disclosure = new RedactedMinaNFT(testnft);
    disclosure.copyPublicAttribute("hasMinaNavigatorsBadge");
    disclosure.copyPublicAttribute("numberOfCommits");
    disclosure.copyPrivateAttribute("MinaNavigatorsBadgeHash");
    console.log(
      "Generating proof, free memory: ",
      os.freemem() / 1024 / 1024 / 1024
    );
    const { publicAttributesProof, privateAttributesProof } =
      await disclosure.proof();
    /*
    console.log(
      "Disclosure proof",
      disclosureProof.publicInput.count.toJSON(),
      disclosureProof.publicInput.hash.toJSON(),
      disclosureProof.publicInput.originalRoot.toJSON(),
      disclosureProof.publicInput.redactedRoot.toJSON()
    );
    */
    expect(publicAttributesProof.publicInput.count.toJSON()).toBe(
      Field(2).toJSON()
    );
    expect(privateAttributesProof.publicInput.count.toJSON()).toBe(
      Field(1).toJSON()
    );
    const hash1 = Poseidon.hash([
      MinaNFT.stringToField("hasMinaNavigatorsBadge"),
      MinaNFT.stringToField("true"),
    ]);
    const hash2 = Poseidon.hash([
      MinaNFT.stringToField("numberOfCommits"),
      Field(12),
    ]);
    const hash3 = Poseidon.hash([hash1, hash2]);
    expect(badgeHash).not.toBeUndefined();
    if (badgeHash === undefined) return;
    const hash4 = Poseidon.hash([
      MinaNFT.stringToField("MinaNavigatorsBadgeHash"),
      badgeHash,
    ]);
    /*
    console.log("hash1", hash1.toJSON());
    console.log("hash2", hash2.toJSON());
    console.log("hash3", hash3.toJSON());
    */
    expect(publicAttributesProof.publicInput.hash.toJSON()).toBe(
      hash3.toJSON()
    );
    expect(privateAttributesProof.publicInput.hash.toJSON()).toBe(
      hash4.toJSON()
    );
    const data = {
      nft: testnft.zkAppPublicKey?.toJSON(),
      publicAttributesProof: publicAttributesProof.toJSON(),
      privateAttributesProof: privateAttributesProof.toJSON(),
    };
    const writeData = JSON.stringify(data, (_, v) =>
      typeof v === "bigint" ? v.toString() : v
    )
      .replaceAll("},", "},\n")
      .replaceAll("[", "[\n")
      .replaceAll("]", "\n]");
    //console.log(writeData);
    const proofFilename = "proof.json";
    await fs.writeFile(proofFilename, writeData);
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
