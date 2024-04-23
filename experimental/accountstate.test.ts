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
} from "o1js";
import { MINAURL } from "../src/config.json";
import { DEPLOYER } from "../env.json";
const transactionFee = 150_000_000;

jest.setTimeout(1000 * 60 * 60); // 1 hour

let deployer: PrivateKey | undefined = undefined;
const useLocal: boolean = false;

class KeyValueEvent extends Struct({
  key: Field,
  value: Field,
}) {}

class KeyValue extends SmartContract {
  @state(Field) key = State<Field>();
  @state(Field) value = State<Field>();

  events = {
    deploy: Field,
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

  @method update(key: Field, value: Field) {
    this.key.assertEquals(this.key.get());
    this.value.assertEquals(this.value.get());

    this.key.set(key);
    this.value.set(value);

    this.emitEvent("update", new KeyValueEvent({ key, value }));
  }
}

class Reader extends SmartContract {
  @state(Field) key = State<Field>();
  @state(Field) value = State<Field>();

  events = {
    deploy: Field,
    read: KeyValueEvent,
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

  @method read(key: Field, value: Field, address: PublicKey) {
    this.key.assertEquals(this.key.get());
    this.value.assertEquals(this.value.get());
    const keyvalue = new KeyValue(address);
    const otherKey = keyvalue.key.get();
    const otherValue = keyvalue.value.get();
    otherKey.assertEquals(key);
    otherValue.assertEquals(value);

    this.key.set(key);
    this.value.set(value);

    this.emitEvent("read", new KeyValueEvent({ key, value }));
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
  console.log("Mina", Mina.getProofsEnabled());
  await KeyValue.compile();
  await Reader.compile();
  console.log("Compiled");
});

describe("Should access other contract state", () => {
  it("should deploy and set values", async () => {
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
    const key: Field = Field(1);
    const value: Field = Field(2);
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

    const zkReaderPrivateKey = PrivateKey.random();
    const zkReaderPublicKey = zkReaderPrivateKey.toPublicKey();
    console.log(
      `deploying the Reader contract to an address ${zkReaderPublicKey.toBase58()} using the deployer with public key ${sender.toBase58()}...`
    );
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkReaderPublicKey });

    const zkReader = new Reader(zkReaderPublicKey);
    const keyReader: Field = Field.random();
    const valueReader: Field = Field.random();
    const transactionReader = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkReader.deploy({});
        zkReader.key.set(keyReader);
        zkReader.value.set(valueReader);
      }
    );

    await transactionReader.prove();
    transactionReader.sign([deployer, zkReaderPrivateKey]);

    //console.log("Sending the deploy transaction...");
    const txReader = await transactionReader.send();
    if (!useLocal) {
      if (txReader.hash() !== undefined) {
        console.log(`
      Success! Deploy transaction sent.
    
      Your smart contract state will be updated
      as soon as the transaction is included in a block:
      https://berkeley.minaexplorer.com/transaction/${txReader.hash()}
      `);
        try {
          await txReader.wait();
        } catch (error) {
          console.log("Error waiting for transaction");
        }
      } else console.error("Send fail", txReader);
      await sleep(30 * 1000);
    }

    await fetchAccount({ publicKey: zkReaderPublicKey });
    const newKeyReader = zkReader.key.get();
    const newValueReader = zkReader.value.get();
    expect(newKeyReader.toJSON()).toBe(keyReader.toJSON());
    expect(newValueReader.toJSON()).toBe(valueReader.toJSON());
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
