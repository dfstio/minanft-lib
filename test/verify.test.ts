import { describe, expect, it } from "@jest/globals";
import os from "os";
import {
  Field,
  AccountUpdate,
  fetchAccount,
  PrivateKey,
  Mina,
  PublicKey,
  UInt64,
  Poseidon,
  JsonProof,
  SmartContract,
  state,
  State,
  method,
} from "o1js";
import { MINAURL } from "../src/config.json";
import { DEPLOYER } from "../env.json";
import { MinaNFT } from "../src/minanft";
import {
  RedactedMinaNFTMapCalculation,
  RedactedMinaNFTMapStateProof,
} from "../src/contract/redactedmap";
import { MinaNFTVerifier } from "../src/contract/verifier";
import { MinaNFTUpdate } from "../src/contract/map";
import {
  nft,
  publicAttributesProof as publicProof,
  privateAttributesProof as privateProof,
} from "../proof.json";
const transactionFee = 150_000_000;

jest.setTimeout(1000 * 60 * 60); // 1 hour

let deployer: PrivateKey | undefined = undefined;
const useLocal: boolean = false;
let verifyer: PublicKey | undefined = PublicKey.fromBase58(
  "B62qq31bXgYULonJp4QdBeekdnQtUZe5DdF8VtWi4MtJ94HKRVwU8Xz"
);

class Key extends SmartContract {
  @state(Field) key = State<Field>();

  @method mint(key: Field) {
    this.key.assertEquals(Field(0));
    this.key.set(key);
  }
}

/*
class Grant extends Struct({
hasBadge
commitsnumber
@method send


class KeyValueEvent extends Struct({
  key: Field,
  value: Field,
}) {}


class Dummy extends SmartContract {
  @state(Field) state = State<Field>();
}


class KeyValue extends SmartContract {
  @state(Field) key = State<Field>();
  @state(Field) value = State<Field>();

  events = {
    deploy: Field,
    mint: KeyValueEvent,
    update: KeyValueEvent,
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

  @method mint(key: Field, value: Field) {
    this.key.assertEquals(Field(0));
    this.value.assertEquals(Field(0));
    this.key.set(key);
    this.value.set(value);
    this.emitEvent("mint", new KeyValueEvent({ key, value }));
  }

  @method update(key: Field, value: Field) {
    this.key.assertEquals(this.key.get());
    this.value.assertEquals(this.value.get());

    this.key.set(key);
    this.value.set(value);

    this.emitEvent("update", new KeyValueEvent({ key, value }));
  }
}
*/

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
  console.log("Compiling, free memory: ", os.freemem() / 1024 / 1024 / 1024);
  //await MinaNFT.compile();
  //await MinaNFTUpdate.compile();
  await Key.compile(); // If this is not compiled, the next compilation will fail. Contaract Key is not used in this test.
  console.log("Compiling RedactedMinaNFTMapCalculation");
  await RedactedMinaNFTMapCalculation.compile(); // Succeed only if compiled after any other contract
  console.log("Compiling MinaNFTVerifier");
  await MinaNFTVerifier.compile();
});

describe("Verify proof of a redacted MinNFT", () => {
  it("should verify proof", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;
    expect(nft).not.toBeUndefined();
    if (nft === undefined) return;
    expect(publicProof).not.toBeUndefined();
    if (publicProof === undefined) return;
    expect(privateProof).not.toBeUndefined();
    if (privateProof === undefined) return;
    const publicAttributesProof: RedactedMinaNFTMapStateProof =
      RedactedMinaNFTMapStateProof.fromJSON(publicProof as JsonProof);
    const privateAttributesProof: RedactedMinaNFTMapStateProof =
      RedactedMinaNFTMapStateProof.fromJSON(privateProof as JsonProof);
    const zkAppPublicKey = PublicKey.fromBase58(nft);

    console.log(
      "Checking proof, free memory: ",
      os.freemem() / 1024 / 1024 / 1024
    );

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
    /*
    console.log("hash1", hash1.toJSON());
    console.log("hash2", hash2.toJSON());
    console.log("hash3", hash3.toJSON());
    */
    expect(publicAttributesProof.publicInput.hash.toJSON()).toBe(
      hash3.toJSON()
    );

    if (verifyer === undefined) verifyer = await deployVerifyer();
    expect(verifyer).not.toBeUndefined();
    if (verifyer === undefined) return;
    await MinaNFT.verify(
      deployer,
      verifyer,
      zkAppPublicKey,
      publicAttributesProof,
      privateAttributesProof
    );
    //console.log("publicAttributesProof", publicAttributesProof.toJSON());
    //console.log("privateAttributesProof", privateAttributesProof.toJSON());
  });
  /*
  it("should deploy and set values in one transaction - variant 1", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;

    const sender = deployer.toPublicKey();
    const zkAppPrivateKey = PrivateKey.random();
    const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    console.log(
      `deploying the KeyValue contract to an address ${zkAppPublicKey.toBase58()} using the deployer with public key ${sender.toBase58()}...`
    );
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppPublicKey });

    const zkApp = new KeyValue(zkAppPublicKey);
    const key: Field = Field.random();
    const value: Field = Field.random();
    const transaction = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkApp.deploy({});
        zkApp.mint(key, value);
      }
    );

    await transaction.prove();
    transaction.sign([deployer, zkAppPrivateKey]);

    //console.log("Sending the deploy transaction...");
    const tx = await transaction.send();
    if (!useLocal) {
      if (tx.hash() !== undefined) {
        console.log(`
      Success! Deploy transaction sent.
    
      Your smart contract state will be updated
      as soon as the transaction is included in a block:
      https://berkeley.minaexplorer.com/transaction/${tx.hash()}
      `);
        try {
          await tx.wait();
        } catch (error) {
          console.log("Error waiting for transaction");
        }
      } else console.error("Send fail", tx);
      await sleep(30 * 1000);
    }

    await fetchAccount({ publicKey: zkAppPublicKey });
    const newKey = zkApp.key.get();
    const newValue = zkApp.value.get();
    expect(newKey.toJSON()).toBe(key.toJSON());
    expect(newValue.toJSON()).toBe(value.toJSON());

    const key1: Field = Field.random();
    const value1: Field = Field.random();
    const transaction1 = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        zkApp.update(key1, value1);
      }
    );

    await transaction1.prove();
    transaction1.sign([deployer]);

    //console.log("Sending the update transaction...");
    const tx1 = await transaction1.send();
    if (!useLocal) {
      if (tx1.hash() !== undefined) {
        console.log(`
      Success! Update transaction sent.
    
      Your smart contract state will be updated
      as soon as the transaction is included in a block:
      https://berkeley.minaexplorer.com/transaction/${tx1.hash()}
      `);
        try {
          await tx1.wait();
        } catch (error) {
          console.log("Error waiting for transaction");
        }
      } else console.error("Send fail", tx1);
      await sleep(30 * 1000);
    }

    await fetchAccount({ publicKey: zkAppPublicKey });
    const newKey1 = zkApp.key.get();
    const newValue1 = zkApp.value.get();
    expect(newKey1.toJSON()).toBe(key1.toJSON());
    expect(newValue1.toJSON()).toBe(value1.toJSON());
  });

  it("should deploy and set values in one transaction - variant 2", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;

    const sender = deployer.toPublicKey();
    const zkAppPrivateKey = PrivateKey.random();
    const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    console.log(
      `deploying the KeyValue contract to an address ${zkAppPublicKey.toBase58()} using the deployer with public key ${sender.toBase58()}...`
    );
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppPublicKey });

    const zkApp = new KeyValue(zkAppPublicKey);
    const key: Field = Field.random();
    const value: Field = Field.random();
    const transaction = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkApp.deploy({});
        zkApp.key.set(key);
        zkApp.value.set(value);
      }
    );

    await transaction.prove();
    transaction.sign([deployer, zkAppPrivateKey]);

    //console.log("Sending the deploy transaction...");
    const tx = await transaction.send();
    if (!useLocal) {
      if (tx.hash() !== undefined) {
        console.log(`
      Success! Deploy transaction sent.
    
      Your smart contract state will be updated
      as soon as the transaction is included in a block:
      https://berkeley.minaexplorer.com/transaction/${tx.hash()}
      `);
        try {
          await tx.wait();
        } catch (error) {
          console.log("Error waiting for transaction");
        }
      } else console.error("Send fail", tx);
      await sleep(30 * 1000);
    }

    await fetchAccount({ publicKey: zkAppPublicKey });
    const newKey = zkApp.key.get();
    const newValue = zkApp.value.get();
    expect(newKey.toJSON()).toBe(key.toJSON());
    expect(newValue.toJSON()).toBe(value.toJSON());

    const key1: Field = Field.random();
    const value1: Field = Field.random();
    const transaction1 = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        zkApp.update(key1, value1);
      }
    );

    await transaction1.prove();
    transaction1.sign([deployer]);

    //console.log("Sending the update transaction...");
    const tx1 = await transaction1.send();
    if (!useLocal) {
      if (tx1.hash() !== undefined) {
        console.log(`
      Success! Update transaction sent.
    
      Your smart contract state will be updated
      as soon as the transaction is included in a block:
      https://berkeley.minaexplorer.com/transaction/${tx1.hash()}
      `);
        try {
          await tx1.wait();
        } catch (error) {
          console.log("Error waiting for transaction");
        }
      } else console.error("Send fail", tx1);
      await sleep(30 * 1000);
    }

    await fetchAccount({ publicKey: zkAppPublicKey });
    const newKey1 = zkApp.key.get();
    const newValue1 = zkApp.value.get();
    expect(newKey1.toJSON()).toBe(key1.toJSON());
    expect(newValue1.toJSON()).toBe(value1.toJSON());
  });
  */
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

async function deployVerifyer(): Promise<PublicKey | undefined> {
  if (deployer === undefined) return undefined;
  const sender = deployer.toPublicKey();
  const zkAppPrivateKey = PrivateKey.random();
  const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
  console.log(
    `deploying the Verifyer contract to an address ${zkAppPublicKey.toBase58()} using the deployer with public key ${sender.toBase58()}...`
  );
  await fetchAccount({ publicKey: sender });
  await fetchAccount({ publicKey: zkAppPublicKey });

  console.log(
    "Deploying verifier, free memory: ",
    os.freemem() / 1024 / 1024 / 1024
  );

  const zkApp = new MinaNFTVerifier(zkAppPublicKey);
  const transaction = await Mina.transaction(
    { sender, fee: transactionFee },
    () => {
      AccountUpdate.fundNewAccount(sender);
      zkApp.deploy({});
    }
  );

  await transaction.prove();
  transaction.sign([deployer, zkAppPrivateKey]);

  //console.log("Sending the deploy transaction...");
  const tx = await transaction.send();
  console.log(
    "Deployed verifier, free memory: ",
    os.freemem() / 1024 / 1024 / 1024
  );
  if (!useLocal) {
    if (tx.hash() !== undefined) {
      console.log(`
    Success! Deploy transaction sent.
  
    Your smart contract state will be updated
    as soon as the transaction is included in a block:
    https://berkeley.minaexplorer.com/transaction/${tx.hash()}
    `);
      try {
        await tx.wait();
      } catch (error) {
        console.log("Error waiting for transaction");
        return undefined;
      }
    } else {
      console.error("Send fail", tx);
      return undefined;
    }
    await sleep(30 * 1000);
  }
  await fetchAccount({ publicKey: zkAppPublicKey });
  return zkAppPublicKey;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
