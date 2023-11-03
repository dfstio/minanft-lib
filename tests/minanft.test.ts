import { describe, expect, it } from "@jest/globals";
import {
  Signature,
  SmartContract,
  method,
  Field,
  state,
  State,
  fetchAccount,
  PrivateKey,
  Mina,
  PublicKey,
  UInt64,
  Poseidon,
} from "o1js";

import { EscrowData } from "../src/contract/escrow";
import { MINAURL, ARCHIVEURL } from "../src/config.json";
import { MinaNFT } from "../src/minanft";
import { MinaNFTBadge } from "../src/minanftbadge";
import { DEPLOYER, DEPLOYERS } from "../env.json";

// use local blockchain or Berkeley
const useLocal: boolean = false;

const DEPLOYERS_NUMBER = 2;
const ITERATIONS_NUMBER = 2; // hangs on 3rd iteration with 2 deployers

jest.setTimeout(1000 * 60 * 60 * 24); // 24 hours

let deployer: PrivateKey | undefined = undefined;
const deployers: PrivateKey[] = [];

class Key extends SmartContract {
  @state(Field) key = State<Field>();

  @method mint(key: Field) {
    this.key.assertEquals(Field(0));
    this.key.set(key);
  }
}

beforeAll(async () => {
  Memory.info("initial");
  if (useLocal) {
    const Local = Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);
    const { privateKey } = Local.testAccounts[0];
    deployer = privateKey;
    for (let i = 1; i <= DEPLOYERS_NUMBER; i++) {
      const { privateKey } = Local.testAccounts[i];
      deployers.push(privateKey);
    }
  } else {
    const network = Mina.Network({
      mina: MINAURL,
      archive: ARCHIVEURL,
    });
    Mina.setActiveInstance(network);
    deployer = PrivateKey.fromBase58(DEPLOYER);
    for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
      const privateKey = PrivateKey.fromBase58(DEPLOYERS[i]);
      deployers.push(privateKey);
    }
  }
  for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
    const balanceDeployer =
      Number((await accountBalance(deployers[i].toPublicKey())).toBigInt()) /
      1e9;
    expect(balanceDeployer).toBeGreaterThan(5);
    if (balanceDeployer <= 5) return;
  }
  const balanceDeployer =
    Number((await accountBalance(deployer.toPublicKey())).toBigInt()) / 1e9;
  console.log(
    "Balance of the Deployer is",
    balanceDeployer.toLocaleString("en")
  );
  expect(balanceDeployer).toBeGreaterThan(2);
  if (balanceDeployer <= 2) return;
  console.log("Compiling...");
  console.time("compiled all");
  await Key.compile();
  await MinaNFT.compile();
  await MinaNFT.compileBadge();
  await MinaNFT.compileRedactedMap();
  console.timeEnd("compiled all");
  Memory.info("compiled");
});

describe("MinaNFT contract", () => {
  it("should deploy MinaNFT constracts and update their state", async () => {
    expect(ITERATIONS_NUMBER).toBeGreaterThan(0);
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;
    /*
    interface MinaNFTBadgeConstructor {
        name: string;
        owner: string;
        verifiedKey: string;
        verifiedKind: string;
        oracle: PublicKey;
        address?: PublicKey;
      }
    */
    console.log("Deploying MinaNFTBadge...");
    const oraclePrivateKey = PrivateKey.random();
    const badge = new MinaNFTBadge({
      name: "badgetest",
      owner: "badgetest",
      verifiedKey: "twitter",
      verifiedKind: "string",
      oracle: oraclePrivateKey.toPublicKey(),
    });
    const badgeTx = await badge.deploy(deployer);
    expect(badgeTx).toBeDefined();
    if (badgeTx === undefined) return;

    const owners: PrivateKey[] = [];
    const newOwners: PrivateKey[] = [];
    const nft: MinaNFT[] = [];
    const txs: Mina.TransactionId[] = [];

    console.log("Minting...");
    for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
      nft.push(new MinaNFT("@test"));
      nft[i].update("description", "string", "my nft @test");
      nft[i].update("image", "string", "ipfs:Qm...");
      nft[i].update("twitter", "string", "@builder");
      const owner: PrivateKey = PrivateKey.random();
      const ownerHash = Poseidon.hash(owner.toPublicKey().toFields());

      const tx = await nft[i].mint(deployers[i], ownerHash);
      expect(tx).toBeDefined();
      if (tx === undefined) return;
      txs.push(tx);
      owners.push(owner);
    }
    Memory.info("minted");
    console.log("Issuing badges...");
    await MinaNFT.wait(badgeTx);
    for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
      await MinaNFT.wait(txs[i]);
      const tx = await badge.issue(
        deployers[i],
        nft[i],
        "twitter",
        oraclePrivateKey
      );
      expect(tx).toBeDefined();
      if (tx === undefined) return;
      txs[i] = tx;
    }
    Memory.info("badges issued");

    console.log("Updating, iteration 1...");
    const escrowPrivateKey1 = PrivateKey.random();
    const escrowPublicKey1 = escrowPrivateKey1.toPublicKey();
    const escrowPrivateKey2 = PrivateKey.random();
    const escrowPublicKey2 = escrowPrivateKey2.toPublicKey();
    const escrowPrivateKey3 = PrivateKey.random();
    const escrowPublicKey3 = escrowPrivateKey3.toPublicKey();
    const escrow = Poseidon.hash([
      Poseidon.hash(escrowPublicKey1.toFields()),
      Poseidon.hash(escrowPublicKey2.toFields()),
      Poseidon.hash(escrowPublicKey3.toFields()),
    ]);

    for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
      await MinaNFT.wait(txs[i]);
      // update metadata
      nft[i].update("twitter", "string", "@mytwittername");
      nft[i].update("discord", "string", "@mydiscordname");
      nft[i].update("linkedin", "string", "@mylinkedinname");
      const tx = await nft[i].commit(deployers[i], owners[i], escrow); // commit the update to blockchain
      expect(tx).toBeDefined();
      if (tx === undefined) return;
      txs[i] = tx;
    }
    Memory.info("updated - first iteration");
    console.log("Transferring...");

    for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
      await MinaNFT.wait(txs[i]);
      const ownerHash = Poseidon.hash(owners[i].toPublicKey().toFields());
      const newOwnerPrivateKey = PrivateKey.random();
      const newOwnerPublicKey = newOwnerPrivateKey.toPublicKey();
      const newOwnerHash = Poseidon.hash(newOwnerPublicKey.toFields());
      const escrowData = new EscrowData({
        oldOwner: ownerHash,
        newOwner: newOwnerHash,
        name: MinaNFT.stringToField(nft[i].name),
        escrow,
      });
      const signature1 = Signature.create(
        escrowPrivateKey1,
        escrowData.toFields()
      );
      const signature2 = Signature.create(
        escrowPrivateKey2,
        escrowData.toFields()
      );
      const signature3 = Signature.create(
        escrowPrivateKey3,
        escrowData.toFields()
      );
      const tx = await nft[i].transfer(
        deployers[i],
        escrowData,
        signature1,
        signature2,
        signature3,
        escrowPublicKey1,
        escrowPublicKey2,
        escrowPublicKey3
      );
      expect(tx).toBeDefined();
      if (tx === undefined) return;
      txs[i] = tx;
      newOwners.push(newOwnerPrivateKey);
    }
    Memory.info("transferred");
    for (let iteration = 2; iteration <= ITERATIONS_NUMBER; iteration++) {
      console.log(`Updating and issuing badges, iteration ${iteration}...`);

      for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
        MinaNFT.wait(txs[i]);
        // update metadata
        nft[i].update("twitter", "string", makeString(15));
        nft[i].update(makeString(10), "string", makeString(15));
        nft[i].update(makeString(10), "string", makeString(15));
        try {
          const tx = await nft[i].commit(deployers[i], newOwners[i]); // commit the update to blockchain
          expect(tx).toBeDefined();
          if (tx === undefined) return;
          txs[i] = tx;
        } catch (e) {
          console.log("Commit failed", e);
          Memory.info();
        }
      }

      for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
        await MinaNFT.wait(txs[i]);
        const tx = await badge.issue(
          deployers[i],
          nft[i],
          "twitter",
          oraclePrivateKey
        );
        expect(tx).toBeDefined();
        if (tx === undefined) return;
        txs[i] = tx;
      }
      Memory.info(`updated and issued badges, iteration ${iteration}`);
    }
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

function makeString(length: number): string {
  let outString: string = "";
  const inOptions: string = "abcdefghijklmnopqrstuvwxyz0123456789";

  for (let i = 0; i < length; i++) {
    outString += inOptions.charAt(Math.floor(Math.random() * inOptions.length));
  }

  return outString;
}

class Memory {
  static rss: number = 0;
  constructor() {
    Memory.rss = 0;
  }

  public static info(description: string = "") {
    const memoryData = process.memoryUsage();
    const formatMemoryUsage = (data: any) =>
      `${Math.round(data / 1024 / 1024)} MB`;
    const oldRSS = Memory.rss;
    Memory.rss = Math.round(memoryData.rss / 1024 / 1024);
    /*
    const memoryUsage = {
      rssDelta: `${oldRSS === 0 ? 0 : Memory.rss - oldRSS} MB`,
      rss: `${formatMemoryUsage(
        memoryData.rss
      )} -> Resident Set Size - total memory allocated`,
      heapTotal: `${formatMemoryUsage(
        memoryData.heapTotal
      )} -> total size of the allocated heap`,
      heapUsed: `${formatMemoryUsage(
        memoryData.heapUsed
      )} -> actual memory used during the execution`,
      external: `${formatMemoryUsage(
        memoryData.external
      )} -> V8 external memory`,
    };
    */

    console.log(
      `RSS memory ${description}: ${formatMemoryUsage(memoryData.rss)}${
        oldRSS === 0
          ? ""
          : ", changed by " + (Memory.rss - oldRSS).toString() + " MB"
      }`
    );
  }
}
