import { describe, expect, it } from "@jest/globals";
import fs from "fs/promises";
import {
  Mina,
  PrivateKey,
  PublicKey,
  UInt64,
  fetchAccount,
  AccountUpdate,
  Field,
  UInt32,
  TokenId,
  Bool,
  Sign,
  Types,
  ZkProgram,
  SmartContract,
  state,
  State,
  method,
  DeployArgs,
  Permissions,
  Struct,
  Cache,
} from "o1js";

import { DEPLOYER } from "../env.json";
import { MINAURL } from "../src/config.json";
import { zkAppPublicKey as zkAppPublicKey58 } from "../json/mysmartcontract.json";

jest.setTimeout(1000 * 60 * 60); // 1 hour
let deployer: PrivateKey | undefined = undefined;

class Element extends Struct({
  key: Field,
  value1: Field,
  value2: Field,
}) {
  constructor(args: any) {
    super(args);
  }
}

const MyZkProgram = ZkProgram({
  name: "MyZkProgram",
  publicInput: Element,

  methods: {
    create: {
      privateInputs: [],

      method(element: Element) {
        element.value1.assertEquals(element.value2);
      },
    },
  },
});

class MyZkProgramProof extends ZkProgram.Proof(MyZkProgram) {}

class MySmartContract extends SmartContract {
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

  init() {
    super.init();
  }

  @method mint(proof: MyZkProgramProof) {
    proof.verify();
    this.key.set(proof.publicInput.key);
    this.value.set(proof.publicInput.value1);
  }
}

describe("Compile a contract", () => {
  it("should compile a contract", async () => {
    const cache: Cache = Cache.FileSystem("./mycache");
    memory();
    console.time("compiled MyZkProgram");
    await MyZkProgram.compile(); // { cache } argument is not supported
    console.timeEnd("compiled MyZkProgram");
    memory();
    console.time("compiled MySmartContract");
    await MySmartContract.compile({ cache });
    console.timeEnd("compiled MySmartContract");
    memory();
  });
});

describe("Send a transaction", () => {
  it("should send a transaction", async () => {
    memory();
    const network = Mina.Network(MINAURL);
    Mina.setActiveInstance(network);
    deployer = PrivateKey.fromBase58(DEPLOYER);
    expect(deployer).toBeDefined();
    if (!deployer) return;

    const balanceDeployer =
      Number((await accountBalance(deployer.toPublicKey())).toBigInt()) / 1e9;
    console.log(
      "Balance of the Deployer is ",
      balanceDeployer.toLocaleString("en")
    );
    expect(balanceDeployer).toBeGreaterThan(2);
    if (balanceDeployer <= 2) return;

    /*
    const file = await fs.readFile("./json/mytx.json", "utf8");
    const txJSON = JSON.parse(file);
    console.log("txJSON", txJSON);
    const zkCommand: Types.Json.ZkappCommand =
      txJSON as Types.Json.ZkappCommand;
    console.log("zkCommand", zkCommand);
    const transaction: Mina.Transaction = Mina.Transaction.fromJSON(
      zkCommand
    ) as Mina.Transaction;
    */
    const transaction: Mina.Transaction = Mina.Transaction.fromJSON(
      JSON.parse(
        await fs.readFile("./json/mytx4.json", "utf8")
      ) as Types.Json.ZkappCommand
    ) as Mina.Transaction;
    //transaction.sign([deployer]);
    //await transaction.prove();
    const sender = deployer.toPublicKey();
    expect(sender).toBeDefined();
    if (!sender) return;
    const zkAppPublicKey = PublicKey.fromBase58(zkAppPublicKey58);
    expect(zkAppPublicKey).toBeDefined();
    if (!zkAppPublicKey) return;
    //transaction.sign([deployer]);
    await transaction.prove();
    const tx = await transaction.send();

    if (tx.hash() !== undefined) {
      console.log(`
      Success! transaction sent.
    
      Your smart contract state will be updated
      as soon as the transaction is included in a block:
      https://berkeley.minaexplorer.com/transaction/${tx.hash()}
      `);
      try {
        memory();
        await tx.wait();
      } catch (error) {
        console.log("Error waiting for transaction");
      }
    } else console.error("Send fail", tx);

    memory();
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
