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
} from "o1js";
import { MINAURL } from "../src/config.json";
import { DEPLOYER } from "../env.json";
const transactionFee = 100_000_000;

jest.setTimeout(1000 * 60 * 60); // 1 hour

let deployer: PrivateKey | undefined = undefined;
const useLocal: boolean = false;

class KeyValue extends SmartContract {
  @state(Field) key = State<Field>();
  @state(Field) value = State<Field>();

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
  }

  @method init() {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertFalse();

    super.init();
  }

  @method mint(key: Field, value: Field) {
    this.key.assertEquals(Field(0));
    this.value.assertEquals(Field(0));
    this.key.set(key);
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
});

describe("Deploy and set initial values values", () => {
  it("should deploy and set values in one transaction", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;

    await KeyValue.compile();
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

    console.log("Sending the deploy transaction...");
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
