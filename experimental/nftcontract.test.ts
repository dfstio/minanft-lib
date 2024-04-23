import { describe, expect, it } from "@jest/globals";
import {
  Field,
  SmartContract,
  AccountUpdate,
  fetchAccount,
  PrivateKey,
  Mina,
  PublicKey,
  UInt64,
  Poseidon,
  MerkleMap,
  Encoding,
} from "o1js";

import {
  MinaNFTContract,
  Metadata,
  Storage,
  Update,
} from "../src/contract/nft";
import { MinaNFTUpdater } from "../src/plugins/updater";

import { MINAURL, ARCHIVEURL } from "../src/config.json";
import { MinaNFT } from "../src/minanft";
import { DEPLOYER, DEPLOYERS } from "../env.json";

// use local blockchain or Berkeley
const useLocal: boolean = true;

const transactionFee = 150_000_000;
const DEPLOYERS_NUMBER = 3;
const tokenSymbol = "VBADGE";

jest.setTimeout(1000 * 60 * 60); // 1 hour

let deployer: PrivateKey | undefined = undefined;
const deployers: PrivateKey[] = [];

let implementation: PublicKey | undefined = undefined;
//let implementationPrivateKey: PrivateKey | undefined = undefined;
let implementationTx: Mina.TransactionId | undefined = undefined;

beforeAll(async () => {
  if (useLocal) {
    const Local = await Mina.LocalBlockchain({ proofsEnabled: true });
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
  console.time("compile");
  await MinaNFTContract.compile();
  await MinaNFTUpdater.compile();
  console.timeEnd("compile");
  //console.timeStamp;
  //console.log("Compiled");
});

describe("NFT Proxy contract", () => {
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

    //console.log("Sending the deploy transaction...");
    const tx = await transaction.send();
    //if (!useLocal) await MinaNFT.transactionInfo(tx);
    //await fetchAccount({ publicKey: zkAppPublicKey });
    implementation = zkAppPublicKey;
    //implementationPrivateKey = zkAppPrivateKey;
    implementationTx = tx;
  });

  it("should deploy MinaNFTContract contracts and update their state", async () => {
    expect(implementation).not.toBeUndefined();
    if (implementation === undefined) return;
    const zkAppPublicKeys: PublicKey[] = [];
    const maps: MerkleMap[] = [];
    const kinds: MerkleMap[] = [];
    const roots: Field[] = [];
    const roots2: Field[] = [];
    const roots3: Field[] = [];
    const kroots: Field[] = [];
    const kroots2: Field[] = [];
    const kroots3: Field[] = [];
    const secrets: Field[] = [];
    const owners: Field[] = [];
    const txs: Mina.TransactionId[] = [];
    const txs2: Mina.TransactionId[] = [];
    const txs3: Mina.TransactionId[] = [];
    const ipfs = `https://ipfs.io/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi`;

    for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
      const sender = deployers[i].toPublicKey();
      const zkAppPrivateKey = PrivateKey.random();
      const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
      console.log(
        `deploying the MinaNFTContract contract to an address ${zkAppPublicKey.toBase58()} using the deployer with public key ${sender.toBase58()}...`
      );
      await fetchAccount({ publicKey: sender });
      await fetchAccount({ publicKey: zkAppPublicKey });

      const zkApp = new MinaNFTContract(zkAppPublicKey);
      const map = new MerkleMap();
      const kind = new MerkleMap();
      map.set(Field.random(), Field.random());
      map.set(Field.random(), Field.random());
      kind.set(Field.random(), Field.random());
      kind.set(Field.random(), Field.random());
      const root = map.getRoot();
      const kroot = kind.getRoot();
      const secret = Field.random();
      const owner = Poseidon.hash([secret]);

      expect(MinaNFTContract._verificationKey).not.toBeUndefined();
      if (MinaNFTContract._verificationKey === undefined) return;

      const transaction = await Mina.transaction(
        { sender, fee: transactionFee, memo: "minanft.io" },
        () => {
          AccountUpdate.fundNewAccount(sender);
          zkApp.deploy({});
          zkApp.metadata.set(new Metadata({ data: root, kind: kroot }));
          zkApp.owner.set(owner);
          zkApp.account.tokenSymbol.set("NFT");
          zkApp.account.zkappUri.set("https://minanft.io/@test");
        }
      );

      await transaction.prove();
      transaction.sign([deployers[i], zkAppPrivateKey]);

      //console.log("Sending the deploy transaction...");
      const tx = await transaction.send();
      zkAppPublicKeys.push(zkAppPublicKey);
      maps.push(map);
      kinds.push(kind);
      roots.push(root);
      kroots.push(kroot);
      map.set(Field.random(), Field.random());
      map.set(Field.random(), Field.random());
      kind.set(Field.random(), Field.random());
      kind.set(Field.random(), Field.random());
      roots2.push(map.getRoot());
      kroots2.push(kind.getRoot());
      map.set(Field.random(), Field.random());
      map.set(Field.random(), Field.random());
      kind.set(Field.random(), Field.random());
      kind.set(Field.random(), Field.random());
      roots3.push(map.getRoot());
      kroots3.push(kind.getRoot());
      secrets.push(secret);
      owners.push(owner);
      txs.push(tx);
    }
    for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
      if (!useLocal) await MinaNFT.transactionInfo(txs[i]);
      await fetchAccount({ publicKey: zkAppPublicKeys[i] });
      const zkApp = new MinaNFTContract(zkAppPublicKeys[i]);
      const newMetadata = zkApp.metadata.get();
      expect(newMetadata.data.toJSON()).toBe(roots[i].toJSON());
      expect(newMetadata.kind.toJSON()).toBe(kroots[i].toJSON());
      const newowner = zkApp.owner.get();
      expect(newowner.toJSON()).toBe(owners[i].toJSON());
    }
    const ipfs_fields = Encoding.stringToFields(ipfs);
    expect(ipfs_fields.length).toEqual(3);
    const storage: Storage = new Storage({ url: ipfs_fields });

    expect(implementation).not.toBeUndefined();
    if (implementation === undefined) return;
    expect(implementationTx).not.toBeUndefined();
    if (implementationTx === undefined) return;
    if (!useLocal) await MinaNFT.transactionInfo(implementationTx);
    await fetchAccount({ publicKey: implementation });
    const zkAppImplementation = new MinaNFTUpdater(implementation);
    const tokenSymbol = Mina.getAccount(implementation).tokenSymbol;
    expect(tokenSymbol).toBeDefined();
    expect(tokenSymbol).toEqual(tokenSymbol);
    const tokenId = zkAppImplementation.token.id;

    console.log("Updating, iteration 1...");

    for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
      const sender = deployers[i].toPublicKey();
      await fetchAccount({ publicKey: zkAppPublicKeys[i] });
      const zkApp = new MinaNFTContract(zkAppPublicKeys[i]);
      const version: UInt64 = zkApp.version.get();
      const newVersion: UInt64 = version.add(UInt64.from(1));
      const data = new Update({
        oldMetadata: new Metadata({ data: roots[i], kind: kroots[i] }),
        newMetadata: new Metadata({ data: roots2[i], kind: kroots2[i] }),
        storage,
        version: newVersion,
        verifier: implementation,
      });

      const transaction = await Mina.transaction(
        { sender, fee: transactionFee },
        () => {
          AccountUpdate.fundNewAccount(sender);
          zkAppImplementation.update(data, zkAppPublicKeys[i], secrets[i]);
        }
      );

      /* Should fail if not sent thru MinaNFTUpdater
      const transaction = await Mina.transaction(
        { sender, fee: transactionFee },
        () => {
          zkApp.update(data, secrets[i]);
        }
      );
      */
      await transaction.prove();
      transaction.sign([deployers[i]]);

      const tx = await transaction.send();
      txs2.push(tx);
    }
    for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
      if (!useLocal) await MinaNFT.transactionInfo(txs2[i]);
      await fetchAccount({ publicKey: zkAppPublicKeys[i] });
      await fetchAccount({ publicKey: zkAppPublicKeys[i], tokenId });
      const zkApp = new MinaNFTContract(zkAppPublicKeys[i]);
      const newMetadata = zkApp.metadata.get();
      expect(newMetadata.data.toJSON()).toBe(roots2[i].toJSON());
      expect(newMetadata.kind.toJSON()).toBe(kroots2[i].toJSON());
      const newStorage = zkApp.storage.get();
      expect(newStorage.url[0].toJSON()).toBe(storage.url[0].toJSON());
      expect(newStorage.url[1].toJSON()).toBe(storage.url[1].toJSON());
      expect(newStorage.url[2].toJSON()).toBe(storage.url[2].toJSON());
      const version = zkApp.version.get();
      expect(version.toJSON()).toBe(Field(1).toJSON());
      const tokenBalance = Mina.getBalance(
        zkAppPublicKeys[i],
        tokenId
      ).value.toBigInt();
      expect(tokenBalance).toEqual(BigInt(1_000_000_000n));
    }

    console.log("Updating, iteration 2...");

    for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
      const sender = deployers[i].toPublicKey();
      await fetchAccount({ publicKey: zkAppPublicKeys[i] });
      const zkApp = new MinaNFTContract(zkAppPublicKeys[i]);
      const version: UInt64 = zkApp.version.get();
      const newVersion: UInt64 = version.add(UInt64.from(1));
      const data = new Update({
        oldMetadata: new Metadata({ data: roots2[i], kind: kroots2[i] }),
        newMetadata: new Metadata({ data: roots3[i], kind: kroots3[i] }),
        storage,
        version: newVersion,
        verifier: implementation,
      });
      const transaction = await Mina.transaction(
        { sender, fee: transactionFee },
        () => {
          //AccountUpdate.fundNewAccount(sender);
          zkAppImplementation.update(data, zkAppPublicKeys[i], secrets[i]);
        }
      );

      await transaction.prove();
      transaction.sign([deployers[i]]);

      const tx = await transaction.send();
      if (i === 0) console.log(transaction.toPretty());
      txs3.push(tx);
    }
    for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
      if (!useLocal) await MinaNFT.transactionInfo(txs3[i]);
      await fetchAccount({ publicKey: zkAppPublicKeys[i] });
      await fetchAccount({ publicKey: zkAppPublicKeys[i], tokenId });
      const zkApp = new MinaNFTContract(zkAppPublicKeys[i]);
      const newMetadata = zkApp.metadata.get();
      expect(newMetadata.data.toJSON()).toBe(roots3[i].toJSON());
      expect(newMetadata.kind.toJSON()).toBe(kroots3[i].toJSON());
      const newStorage = zkApp.storage.get();
      expect(newStorage.url[0].toJSON()).toBe(storage.url[0].toJSON());
      expect(newStorage.url[1].toJSON()).toBe(storage.url[1].toJSON());
      expect(newStorage.url[2].toJSON()).toBe(storage.url[2].toJSON());
      const version = zkApp.version.get();
      const tokenBalance = Mina.getBalance(
        zkAppPublicKeys[i],
        tokenId
      ).value.toBigInt();
      expect(version.toJSON()).toBe(Field(2).toJSON());
      expect(tokenBalance).toEqual(BigInt(2_000_000_000n));
      if (i === 0) await displayEvents(zkApp);
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

async function displayEvents(contract: SmartContract) {
  const events = await contract.fetchEvents();
  console.log(
    `events on ${contract.address.toBase58()}`,
    events.map((e) => {
      return { type: e.type, data: JSON.stringify(e.event) };
    })
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
