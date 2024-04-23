import { describe, expect, it } from "@jest/globals";
import fs from "fs/promises";
import {
  Field,
  AccountUpdate,
  fetchAccount,
  PrivateKey,
  Mina,
  PublicKey,
  UInt64,
  SmartContract,
  state,
  State,
  method,
} from "o1js";
import { MINAURL } from "../src/config.json";
import { DEPLOYER } from "../env.json";
import { MinaNFT } from "../src/minanft";
import { MinaNFTBadge } from "../src/plugins/badgeproof";
import { MinaNFTVerifierBadge } from "../src/plugins/badge";

const transactionFee = 150_000_000;
jest.setTimeout(1000 * 60 * 60); // 1 hour

let deployer: PrivateKey | undefined = undefined;
const useLocal: boolean = false;

class Key extends SmartContract {
  @state(Field) key = State<Field>();

  @method mint(key: Field) {
    this.key.assertEquals(Field(0));
    this.key.set(key);
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
  console.time("compiled");
  await Key.compile(); // If this is not compiled, the next compilation will fail. Contaract Key is not used in this test.
  console.log("Compiling RedactedMinaNFTMapCalculation");
  await MinaNFT.compileRedactedMap(); // Succeed only if compiled after any other contract
  console.log("Compiling MinaNFTVBadge");
  await MinaNFTBadge.compile();
  console.log("Compiling MinaNFTVerifierBadge");
  await MinaNFTVerifierBadge.compile();
  console.timeEnd("compiled");
});

describe("Deploy MinaNFTVerifierBadge", () => {
  it("should deploy MinaNFTVerifierBadge", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;
    await deployVerifier();
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

async function deployVerifier(): Promise<PublicKey | undefined> {
  if (deployer === undefined) return undefined;
  const sender = deployer.toPublicKey();
  const zkAppPrivateKey = PrivateKey.random();
  const oracle = PrivateKey.random();
  const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
  console.log(
    `deploying the verifier contract to an address ${zkAppPublicKey.toBase58()} using the deployer with public key ${sender.toBase58()}...`
  );
  await fetchAccount({ publicKey: sender });
  await fetchAccount({ publicKey: zkAppPublicKey });

  const zkApp = new MinaNFTVerifierBadge(zkAppPublicKey);
  const transaction = await Mina.transaction(
    { sender, fee: transactionFee },
    () => {
      AccountUpdate.fundNewAccount(sender);
      zkApp.deploy({});
      zkApp.oracle.set(oracle.toPublicKey());
      zkApp.verifiedKey.set(MinaNFT.stringToField("twitter"));
      zkApp.verifiedKind.set(MinaNFT.stringToField("string"));
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
        return undefined;
      }
    } else {
      console.error("Send fail", tx);
      return undefined;
    }
    await sleep(30 * 1000);
  }
  await fetchAccount({ publicKey: zkAppPublicKey });
  await fs.writeFile(
    "badge.json",
    JSON.stringify({
      BADGE: zkAppPublicKey.toBase58(),
      ORACLE: oracle.toBase58(),
    })
  );
  return zkAppPublicKey;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
