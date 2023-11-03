import { describe, expect, it } from "@jest/globals";
import fs from "fs/promises";
import {
  Field,
  SmartContract,
  state,
  State,
  method,
  ZkProgram,
  Struct,
  Cache,
  Mina,
  PublicKey,
  PrivateKey,
  fetchAccount,
  AccountUpdate,
  UInt64,
  DeployArgs,
  Permissions,
} from "o1js";
import { DEPLOYER } from "../env.json";
import { MINAURL } from "../src/config.json";
jest.setTimeout(1000 * 60 * 60); // 1 hour
const transactionFee = 150_000_000;
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
  it("should deploy a contract", async () => {
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
    await fs.writeFile(
      "./json/sender.json",
      JSON.stringify({ sender: deployer.toPublicKey().toBase58() })
    );

    const sender = deployer.toPublicKey();
    const zkAppPrivateKey = PrivateKey.random();
    const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    console.log(
      `deploying the MySmartContract contract to an address ${zkAppPublicKey.toBase58()} using the deployer with public key ${sender.toBase58()}...`
    );
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppPublicKey });

    memory("before deploy");
    const zkApp = new MySmartContract(zkAppPublicKey);
    const transaction = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkApp.deploy({});
      }
    );

    await transaction.prove();
    transaction.sign([deployer, zkAppPrivateKey]);

    console.log("Sending the deploy transaction...");
    const tx = await transaction.send();

    if (tx.hash() !== undefined) {
      console.log(`
      Success! Deploy transaction sent.
    
      Your smart contract state will be updated
      as soon as the transaction is included in a block:
      https://berkeley.minaexplorer.com/transaction/${tx.hash()}
      `);
      await fs.writeFile(
        "./json/mysmartcontract.json",
        JSON.stringify({ zkAppPublicKey: zkAppPublicKey.toBase58() })
      );
      try {
        memory();
        await tx.wait();
      } catch (error) {
        console.log("Error waiting for transaction");
      }
    } else console.error("Send fail", tx);

    memory();

    await fs.writeFile(
      "./json/mysmartcontract.json",
      JSON.stringify({ zkAppPublicKey: zkAppPublicKey.toBase58() })
    );
  });
});

function memory(memo: string = "") {
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

  console.log(memo, memoryUsage);
}

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
