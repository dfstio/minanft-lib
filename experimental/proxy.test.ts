import { describe, expect, it } from "@jest/globals";
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
  Struct,
  Poseidon,
  MerkleMap,
  Encoding,
  Account,
  Provable,
} from "o1js";
import { MINAURL, ARCHIVEURL } from "../src/config.json";
import { MinaNFT } from "../src/minanft";
import { DEPLOYER, DEPLOYERS } from "../env.json";

const useLocal: boolean = false;

const transactionFee = 150_000_000;
const DEPLOYERS_NUMBER = 3;
const tokenSymbol = "VBADGE";

jest.setTimeout(1000 * 60 * 60); // 1 hour

let deployer: PrivateKey | undefined = undefined;
const deployers: PrivateKey[] = [];

class Storage extends Struct({
  hash: [Field, Field, Field], // IPFS or Arweave url
}) {}

class Update extends Struct({
  oldRoot: Field,
  newRoot: Field,
  storage: Storage,
  verifier: PublicKey,
  version: UInt64,
}) {}

class Metadata extends Struct({
  data: Field,
  kind: Field,
}) {}

class NFTproxy extends SmartContract {
  @state(Field) root = State<Field>();
  @state(Metadata) metadata = State<Metadata>();
  @state(Field) pwdHash = State<Field>();
  @state(UInt64) version = State<UInt64>();

  events = {
    mint: Field,
    update: Update,
  };

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      setDelegate: Permissions.proof(),
      setPermissions: Permissions.proof(),
      setVerificationKey: Permissions.proof(),
      setZkappUri: Permissions.proof(),
      setTokenSymbol: Permissions.proof(),
      incrementNonce: Permissions.proof(),
      setVotingFor: Permissions.proof(),
      setTiming: Permissions.proof(),
    });
    this.emitEvent("mint", Field(0));
  }

  init() {
    super.init();
  }

  @method update(data: Update, secret: Field) {
    this.pwdHash.assertEquals(this.pwdHash.get());
    this.pwdHash.assertEquals(Poseidon.hash([secret]));

    this.root.assertEquals(this.root.get());
    this.root.assertEquals(data.oldRoot);

    const version = this.version.get();
    this.version.assertEquals(version);
    const newVersion = version.add(UInt64.from(1));
    newVersion.assertEquals(data.version);

    this.root.set(data.newRoot);
    this.version.set(newVersion);

    this.emitEvent("update", data);
  }
}

class ImplementationEvent extends Struct({
  address: PublicKey,
  update: Update,
}) {}

class StatelessImplementation extends SmartContract {
  events = {
    deploy: Field,
    update: ImplementationEvent,
  };

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      setDelegate: Permissions.proof(),
      setPermissions: Permissions.proof(),
      setVerificationKey: Permissions.proof(),
      setZkappUri: Permissions.proof(),
      setTokenSymbol: Permissions.proof(),
      incrementNonce: Permissions.proof(),
      setVotingFor: Permissions.proof(),
      setTiming: Permissions.proof(),
    });
    this.emitEvent("deploy", Field(0));
  }

  init() {
    super.init();
  }

  @method update(data: Update, address: PublicKey, secret: Field) {
    const nft = new NFTproxy(address);
    const root = nft.root.get();
    root.assertEquals(data.oldRoot);
    this.address.assertEquals(data.verifier);

    // Check that all versions are properly verified
    const version = nft.version.get();
    const account = Account(address, this.token.id);
    const tokenBalance = account.balance.get();
    account.balance.assertEquals(tokenBalance);
    //Provable.log("tokenBalance", tokenBalance);
    //Provable.log("version", version);
    tokenBalance.assertEquals(version.mul(UInt64.from(1_000_000_000n)));

    nft.update(data, secret);
    this.token.mint({ address, amount: 1_000_000_000n });

    this.emitEvent(
      "update",
      new ImplementationEvent({ address, update: data })
    );
  }
}

let implementation: PublicKey | undefined = undefined;
//let implementationPrivateKey: PrivateKey | undefined = undefined;
let implementationTx: Mina.TransactionId | undefined = undefined;

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
  console.time("compile");
  await NFTproxy.compile();
  await StatelessImplementation.compile();
  console.timeEnd("compile");
  //console.timeStamp;
  //console.log("Compiled");
});

describe("NFT Proxy contract", () => {
  it("should deploy StatelessImplementation contract", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;

    const sender = deployer.toPublicKey();
    const zkAppPrivateKey = PrivateKey.random();
    const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    console.log(
      `deploying the StatelessImplementation contract to an address ${zkAppPublicKey.toBase58()} using the deployer with public key ${sender.toBase58()}...`
    );
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppPublicKey });

    const zkApp = new StatelessImplementation(zkAppPublicKey);
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

  it("should deploy NFTproxy contracts and update their state", async () => {
    expect(implementation).not.toBeUndefined();
    if (implementation === undefined) return;
    const zkAppPublicKeys: PublicKey[] = [];
    const maps: MerkleMap[] = [];
    const roots: Field[] = [];
    const roots2: Field[] = [];
    const roots3: Field[] = [];
    const secrets: Field[] = [];
    const pwdHashes: Field[] = [];
    const txs: Mina.TransactionId[] = [];
    const txs2: Mina.TransactionId[] = [];
    const txs3: Mina.TransactionId[] = [];
    const ipfs = `ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi`;

    for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
      const sender = deployers[i].toPublicKey();
      const zkAppPrivateKey = PrivateKey.random();
      const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
      console.log(
        `deploying the NFTproxy contract to an address ${zkAppPublicKey.toBase58()} using the deployer with public key ${sender.toBase58()}...`
      );
      await fetchAccount({ publicKey: sender });
      await fetchAccount({ publicKey: zkAppPublicKey });

      const zkApp = new NFTproxy(zkAppPublicKey);
      const map = new MerkleMap();
      map.set(Field.random(), Field.random());
      map.set(Field.random(), Field.random());
      const root = map.getRoot();
      const secret = Field.random();
      const pwdHash = Poseidon.hash([secret]);

      expect(NFTproxy._verificationKey).not.toBeUndefined();
      if (NFTproxy._verificationKey === undefined) return;

      const transaction = await Mina.transaction(
        { sender, fee: transactionFee, memo: "minanft.io" },
        () => {
          AccountUpdate.fundNewAccount(sender);
          zkApp.deploy({});
          zkApp.root.set(root);
          zkApp.pwdHash.set(pwdHash);
          zkApp.account.tokenSymbol.set("NFT");
          zkApp.account.zkappUri.set(ipfs);
        }
      );

      await transaction.prove();
      transaction.sign([deployers[i], zkAppPrivateKey]);

      //console.log("Sending the deploy transaction...");
      const tx = await transaction.send();
      zkAppPublicKeys.push(zkAppPublicKey);
      maps.push(map);
      roots.push(root);
      map.set(Field.random(), Field.random());
      map.set(Field.random(), Field.random());
      roots2.push(map.getRoot());
      map.set(Field.random(), Field.random());
      map.set(Field.random(), Field.random());
      roots3.push(map.getRoot());
      secrets.push(secret);
      pwdHashes.push(pwdHash);
      txs.push(tx);
    }
    for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
      if (!useLocal) await MinaNFT.transactionInfo(txs[i]);
      await fetchAccount({ publicKey: zkAppPublicKeys[i] });
      const zkApp = new NFTproxy(zkAppPublicKeys[i]);
      const newRoot = zkApp.root.get();
      expect(newRoot.toJSON()).toBe(roots[i].toJSON());
      const newPwdHash = zkApp.pwdHash.get();
      expect(newPwdHash.toJSON()).toBe(pwdHashes[i].toJSON());
    }
    const ipfs_fields = Encoding.stringToFields(ipfs);
    expect(ipfs_fields.length).toEqual(3);
    const storage: Storage = new Storage({ hash: ipfs_fields });

    expect(implementation).not.toBeUndefined();
    if (implementation === undefined) return;
    //expect(implementationPrivateKey).not.toBeUndefined();
    //if (implementationPrivateKey === undefined) return;
    expect(implementationTx).not.toBeUndefined();
    if (implementationTx === undefined) return;
    if (!useLocal) await MinaNFT.transactionInfo(implementationTx);
    await fetchAccount({ publicKey: implementation });
    const zkAppImplementation = new StatelessImplementation(implementation);
    const tokenSymbol = Mina.getAccount(implementation).tokenSymbol;
    expect(tokenSymbol).toBeDefined();
    expect(tokenSymbol).toEqual(tokenSymbol);
    const tokenId = zkAppImplementation.token.id;

    console.log("Updating 1...");

    for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
      const sender = deployers[i].toPublicKey();
      await fetchAccount({ publicKey: zkAppPublicKeys[i] });
      const zkApp = new NFTproxy(zkAppPublicKeys[i]);
      const version: UInt64 = zkApp.version.get();
      const newVersion: UInt64 = version.add(UInt64.from(1));
      const data = new Update({
        oldRoot: roots[i],
        newRoot: roots2[i],
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

      /* Should fail if not sent thru StatelessImplementation
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
      const zkApp = new NFTproxy(zkAppPublicKeys[i]);
      const newRoot = zkApp.root.get();
      expect(newRoot.toJSON()).toBe(roots2[i].toJSON());
      const version = zkApp.version.get();
      expect(version.toJSON()).toBe(Field(1).toJSON());
      /*
      const tokenBalance = Mina.getBalance(
        zkAppPublicKeys[i],
        tokenId
      ).value.toBigInt();
      expect(tokenBalance).toEqual(BigInt(1_000_000_000n));
      */
    }

    console.log("Updating 2...");

    for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
      const sender = deployers[i].toPublicKey();
      await fetchAccount({ publicKey: zkAppPublicKeys[i] });
      const zkApp = new NFTproxy(zkAppPublicKeys[i]);
      const version: UInt64 = zkApp.version.get();
      const newVersion: UInt64 = version.add(UInt64.from(1));
      const data = new Update({
        oldRoot: roots2[i],
        newRoot: roots3[i],
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
      txs3.push(tx);
    }
    for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
      if (!useLocal) await MinaNFT.transactionInfo(txs3[i]);
      await fetchAccount({ publicKey: zkAppPublicKeys[i] });
      await fetchAccount({ publicKey: zkAppPublicKeys[i], tokenId });
      const zkApp = new NFTproxy(zkAppPublicKeys[i]);
      const newRoot = zkApp.root.get();
      expect(newRoot.toJSON()).toBe(roots3[i].toJSON());
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
