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
import { DEPLOYER, DEPLOYERS } from "../env.json";

// use local blockchain or Berkeley
const useLocal: boolean = true;

const DEPLOYERS_NUMBER = 1;
const ITERATIONS_NUMBER = 1000;

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
  memory();
  if (useLocal) {
    const Local = Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);
    const { privateKey } = Local.testAccounts[0];
    deployer = privateKey;
    for (let i = 1; i <= DEPLOYERS_NUMBER; i++) {
      const { privateKey } = Local.testAccounts[i];
      const balanceDeployer =
        Number((await accountBalance(privateKey.toPublicKey())).toBigInt()) /
        1e9;
      expect(balanceDeployer).toBeGreaterThan(3);
      if (balanceDeployer <= 3) return;
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
      const balanceDeployer =
        Number((await accountBalance(privateKey.toPublicKey())).toBigInt()) /
        1e9;
      expect(balanceDeployer).toBeGreaterThan(3);
      if (balanceDeployer <= 3) return;
      deployers.push(privateKey);
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
  await Key.compile();
  console.time("compiled");
  await MinaNFT.compile();
  console.timeEnd("compiled");
  //await MinaNFT.compileUpdater();
});

describe("MinaNFT contract", () => {
  it("should deploy MinaNFT constracts and update their state", async () => {
    memory();
    expect(ITERATIONS_NUMBER).toBeGreaterThan(0);
    const owners: PrivateKey[] = [];
    const newOwners: PrivateKey[] = [];
    const nft: MinaNFT[] = [];

    for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
      nft.push(new MinaNFT("@test"));
      nft[i].update("description", "string", "my nft @test");
      nft[i].update("image", "string", "ipfs:Qm...");
      const owner: PrivateKey = PrivateKey.random();
      const ownerHash = Poseidon.hash(owner.toPublicKey().toFields());

      await nft[i].mint(deployers[i], ownerHash);
      owners.push(owner);
    }

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
      // update metadata
      nft[i].update("twitter", "string", "@mytwittername");
      nft[i].update("discord", "string", "@mydiscordname");
      nft[i].update("linkedin", "string", "@mylinkedinname");
      await nft[i].commit(deployers[i], owners[i], escrow); // commit the update to blockchain
    }

    console.log("Transferring...");

    for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
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
      await nft[i].transfer(
        deployers[i],
        escrowData,
        signature1,
        signature2,
        signature3,
        escrowPublicKey1,
        escrowPublicKey2,
        escrowPublicKey3
      );
      newOwners.push(newOwnerPrivateKey);
    }
    memory();
    for (let iteration = 2; iteration <= ITERATIONS_NUMBER; iteration++) {
      console.log(`Updating, iteration ${iteration}...`);

      for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
        // update metadata
        nft[i].update(makeString(10), "string", makeString(15));
        nft[i].update(makeString(10), "string", makeString(15));
        nft[i].update(makeString(10), "string", makeString(15));
        try {
          await nft[i].commit(deployers[i], newOwners[i]); // commit the update to blockchain
        } catch (e) {
          console.log("Commit failed", e);
          memory();
        }
        memory();
      }
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

function memory() {
  const memoryData = process.memoryUsage();
  const formatMemoryUsage = (data: any) =>
    `${Math.round((data / 1024 / 1024) * 100) / 100} MB`;

  const memoryUsage = {
    rss: `${formatMemoryUsage(
      memoryData.rss
    )} -> Resident Set Size - total memory allocated for the process execution`,
    heapTotal: `${formatMemoryUsage(
      memoryData.heapTotal
    )} -> total size of the allocated heap`,
    heapUsed: `${formatMemoryUsage(
      memoryData.heapUsed
    )} -> actual memory used during the execution`,
    external: `${formatMemoryUsage(memoryData.external)} -> V8 external memory`,
  };

  console.log(memoryUsage);
}
