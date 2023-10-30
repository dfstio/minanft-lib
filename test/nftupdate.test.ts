import { describe, expect, it } from "@jest/globals";
import {
  Signature,
  AccountUpdate,
  fetchAccount,
  PrivateKey,
  Mina,
  PublicKey,
  UInt64,
  Poseidon,
} from "o1js";

import { MinaNFTUpdater } from "../src/plugins/updater";
import { Escrow, EscrowData, EscrowProof } from "../src/contract/escrow";

import { MINAURL, ARCHIVEURL } from "../src/config.json";
import { MinaNFT } from "../src/minanft";
import { DEPLOYER, DEPLOYERS } from "../env.json";

// use local blockchain or Berkeley
const useLocal: boolean = true;

const transactionFee = 150_000_000;
const DEPLOYERS_NUMBER = 1;
const tokenSymbol = "VBADGE";

jest.setTimeout(1000 * 60 * 60 * 24); // 24 hours

let deployer: PrivateKey | undefined = undefined;
const deployers: PrivateKey[] = [];

let updater: PublicKey | undefined = undefined;
//let updaterPrivateKey: PrivateKey | undefined = undefined;
let updaterTx: Mina.TransactionId | undefined = undefined;

beforeAll(async () => {
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
  console.time("compiled");
  await MinaNFT.compile();
  await MinaNFT.compileUpdate();
  await MinaNFT.compileUpdater();
  console.timeEnd("compiled");
});

describe("MinaNFT contract", () => {
  it("should deploy MinaNFTUpdater contract", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;

    const sender = deployer.toPublicKey();
    const zkAppPrivateKey = PrivateKey.random();
    const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    console.log(
      `deploying the MinaNFTUpdater contract to an address ${zkAppPublicKey.toBase58()} using the deployer with public key ${sender.toBase58()}...`
    );
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppPublicKey });

    const zkApp = new MinaNFTUpdater(zkAppPublicKey);
    const transaction = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkApp.deploy({});
        zkApp.account.tokenSymbol.set(tokenSymbol);
      }
    );
    await transaction.prove();
    transaction.sign([deployer, zkAppPrivateKey]);
    const tx = await transaction.send();
    updater = zkAppPublicKey;
    updaterTx = tx;
  });

  it("should deploy MinaNFT constracts and update their state", async () => {
    expect(updater).not.toBeUndefined();
    if (updater === undefined) return;
    const nfts: MinaNFT[] = [];
    const nfts2: MinaNFT[] = [];
    const nfts3: MinaNFT[] = [];
    const owners: PrivateKey[] = [];

    for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
      const nft = new MinaNFT("@test");
      nft.update("description", "string", "my nft @test");
      nft.update("image", "string", "ipfs:Qm...");
      const owner: PrivateKey = PrivateKey.random();
      const ownerHash = Poseidon.hash(owner.toPublicKey().toFields());

      await nft.mint(deployers[i], ownerHash);
      owners.push(owner);
      nfts.push(nft);
    }

    expect(updater).not.toBeUndefined();
    if (updater === undefined) return;
    expect(updaterTx).not.toBeUndefined();
    if (updaterTx === undefined) return;
    if (!useLocal) await MinaNFT.transactionInfo(updaterTx, "deploy updater");
    await fetchAccount({ publicKey: updater });
    const tokenSymbol = Mina.getAccount(updater).tokenSymbol;
    expect(tokenSymbol).toBeDefined();
    expect(tokenSymbol).toEqual(tokenSymbol);

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
      const nft: MinaNFT = nfts[i];
      // update metadata
      nft.update("twitter", "string", "@mytwittername");
      nft.update("discord", "string", "@mydiscordname");
      nft.update("linkedin", "string", "@mylinkedinname");
      await nft.commit(deployers[i], owners[i], updater, escrow); // commit the update to blockchain
      nfts2.push(nft);
    }

    //await sleep(1000 * 60 * 10); // 10 minutes
    /*
    console.log("Updating, iteration 2...");

    for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
      const nft: MinaNFT = nfts2[i];
      // update metadata
      nft.update("twitter2", "string", "@mytwittername2");
      nft.update("discord2", "string", "@mydiscordname2");
      nft.update("linkedin2", "string", "@mylinkedinname2");
      await nft.commit(deployers[i], owners[i], updater); // commit the update to blockchain
      nfts3.push(nft);
    }
    */
    console.log("Transferring...");

    for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
      const nft: MinaNFT = nfts2[i];
      const ownerHash = Poseidon.hash(owners[i].toPublicKey().toFields());
      const newOwnerPrivateKey = PrivateKey.random();
      const newOwnerPublicKey = newOwnerPrivateKey.toPublicKey();
      const newOwnerHash = Poseidon.hash(newOwnerPublicKey.toFields());
      const escrowData = new EscrowData({
        oldOwner: ownerHash,
        newOwner: newOwnerHash,
        name: MinaNFT.stringToField(nft.name),
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
      const proofEscrow: EscrowProof = await Escrow.create(
        escrowData,
        signature1,
        signature2,
        signature3,
        escrowPublicKey1,
        escrowPublicKey2,
        escrowPublicKey3
      );
      await nft.transfer(deployers[i], proofEscrow);
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
