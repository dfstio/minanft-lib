import { describe, expect, it } from "@jest/globals";
import os from "os";
import fs from "fs/promises";
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
import { RedactedMinaNFTMapStateProof } from "../src/plugins/redactedmap";
import { MinaNFTVerifier } from "../src/plugins/verifier";
import { proof } from "../proof.json";
import { nft } from "../address.json";
import { VERIFIER } from "../verifier.json";
/*
const VERIFIER = undefined;
const proof = undefined;
const nft = undefined;
*/
const transactionFee = 150_000_000;

jest.setTimeout(1000 * 60 * 60); // 1 hour

let deployer: PrivateKey | undefined = undefined;
const useLocal: boolean = false;
let verifier: PublicKey | undefined = undefined;
//PublicKey.fromBase58("B62qq31bXgYULonJp4QdBeekdnQtUZe5DdF8VtWi4MtJ94HKRVwU8Xz");

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
  console.log("Compiling, free memory: ", os.freemem() / 1024 / 1024 / 1024);
  console.time("compiled");
  await Key.compile(); // If this is not compiled, the next compilation will fail. Contaract Key is not used in this test.
  console.log("Compiling RedactedMinaNFTMapCalculation");
  await MinaNFT.compileRedactedMap(); // Succeed only if compiled after any other contract
  console.log("Compiling MinaNFTVerifier");
  await MinaNFT.compileVerifier();
  console.timeEnd("compiled");
});

describe("Verify proof of a redacted MinNFT", () => {
  it("should deploy verifier if necessary", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;
    if (VERIFIER === undefined) verifier = await deployVerifier();
    else verifier = PublicKey.fromBase58(VERIFIER);

    expect(verifier).not.toBeUndefined();
    if (verifier === undefined) return;
  });

  it("should verify proof", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;
    expect(nft).not.toBeUndefined();
    if (nft === undefined) return;
    expect(proof).not.toBeUndefined();
    if (proof === undefined) return;
    expect(verifier).not.toBeUndefined();
    if (verifier === undefined) return;

    const redactedProof: RedactedMinaNFTMapStateProof =
      RedactedMinaNFTMapStateProof.fromJSON(proof as JsonProof);
    const zkAppPublicKey = PublicKey.fromBase58(nft);

    console.log(
      "Checking proof, free memory: ",
      os.freemem() / 1024 / 1024 / 1024
    );

    expect(redactedProof.publicInput.count.toJSON()).toBe(Field(3).toJSON());

    await MinaNFT.verify(deployer, verifier, zkAppPublicKey, redactedProof);
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
  const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
  console.log(
    `deploying the verifier contract to an address ${zkAppPublicKey.toBase58()} using the deployer with public key ${sender.toBase58()}...`
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
  await fs.writeFile(
    "verifier.json",
    JSON.stringify({ VERIFIER: zkAppPublicKey.toBase58() })
  );
  return zkAppPublicKey;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
