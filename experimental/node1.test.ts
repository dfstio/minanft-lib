import { describe, expect, it } from "@jest/globals";
import {
  Field,
  state,
  State,
  method,
  SmartContract,
  AccountUpdate,
  fetchAccount,
  PrivateKey,
  Mina,
  PublicKey,
  UInt64,
} from "o1js";
import { DEPLOYER } from "../env.json";
import { MinaNFT } from "../src/minanft";
const TESTNET = "https://proxy.testworld.minaexplorer.com/graphql";
const transactionFee = 150_000_000;

jest.setTimeout(1000 * 60 * 60); // 1 hour

let deployer: PrivateKey | undefined = undefined;
const useLocal: boolean = false;

class KeyValue extends SmartContract {
  @state(Field) key = State<Field>();
  @state(Field) value = State<Field>();

  @method update(value: Field) {
    this.key.getAndAssertEquals();
    Field(0).assertNotEquals(this.key.get());
    this.value.set(value);
  }
}

beforeAll(async () => {
  if (useLocal) {
    const Local = Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);
    const { privateKey } = Local.testAccounts[0];
    deployer = privateKey;
  } else {
    const network = Mina.Network({
        mina: TESTNET,
    });
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

  console.log("Compiling the contracts...");
  console.time("compiled");
  await KeyValue.compile();
  console.timeEnd("compiled");
});

describe("Deploy and set initial values", () => {
  it("should deploy and set values verifying signature", async () => {
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
    const value: Field = Field.random();
    const transaction = await Mina.transaction(
      { sender, fee: transactionFee * 2 },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkApp.deploy({});
        zkApp.key.set(key);
        zkApp.value.set(value);
      }
    );

    await transaction.prove();
    transaction.sign([deployer, zkAppPrivateKey]);

    console.log("Sending the deploy transaction...");
    let tx = await transaction.send();
    if (!useLocal) await MinaNFT.transactionInfo(tx, "deploy");

    await fetchAccount({ publicKey: zkAppPublicKey });
    const newKey = zkApp.key.get();
    const newValue = zkApp.value.get();
    expect(newKey.toJSON()).toBe(key.toJSON());
    expect(newValue.toJSON()).toBe(value.toJSON());

    let value1: Field = Field(0);
    let startFee = transactionFee;

    for( let i = 0; i < 1000; i++) {
          value1 = Field(i+10);

          const transaction1 = await Mina.transaction(
            { sender, fee: startFee + i  * 1_000_000},
            () => {
              zkApp.update(value1);
            }
          );

          await transaction1.prove();
          transaction1.sign([deployer]);

          //console.log("Sending the update transaction...");
          tx = await transaction1.send();
          if (!useLocal) await MinaNFT.transactionInfo(tx, "update", false);
          if( tx.isSuccess === false ) {
            await sleep(10000); // 10 seconds
            await fetchAccount({ publicKey: sender });
            await fetchAccount({ publicKey: zkAppPublicKey });
            startFee = transactionFee - i * 1_000_000;
          }
    }
    await MinaNFT.wait(tx);
    await fetchAccount({ publicKey: zkAppPublicKey });
    const newValue1 = zkApp.value.get();
    expect(newValue1.toJSON()).toBe(value1.toJSON());
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
