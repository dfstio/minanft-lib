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
  fetchAccount,
  DeployArgs,
  Permissions,
  PrivateKey,
  verify,
} from "o1js";
import { sender as senderPublicKey } from "../json/sender.json";
import { zkAppPublicKey as zkAppPublicKey58 } from "../json/mysmartcontract.json";
import { MINAURL } from "../src/config.json";
import { DEPLOYER } from "../env.json";

let deployer: PrivateKey | undefined = undefined;
jest.setTimeout(1000 * 60 * 60); // 1 hour

const transactionFee = 150_000_000;

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

let verificationKeyZkProgram: string | undefined = undefined;

describe("Compile a contract", () => {
  it("should compile a contract", async () => {
    const cache: Cache = Cache.FileSystem("./mycache");
    memory();
    console.time("compiled MyZkProgram");
    const { verificationKey } = await MyZkProgram.compile(); // { cache } argument is not supported
    console.timeEnd("compiled MyZkProgram");
    verificationKeyZkProgram = verificationKey;
    memory();
    console.time("compiled MySmartContract");
    await MySmartContract.compile({ cache });
    console.timeEnd("compiled MySmartContract");
    memory();
  });
  it("should prepare a transaction", async () => {
    memory();
    const network = Mina.Network(MINAURL);
    Mina.setActiveInstance(network);
    deployer = PrivateKey.fromBase58(DEPLOYER);
    expect(deployer).toBeDefined();
    if (!deployer) return;
    const sender = PublicKey.fromBase58(senderPublicKey);
    expect(sender).toBeDefined();
    if (!sender) return;
    const zkAppPublicKey = PublicKey.fromBase58(zkAppPublicKey58);
    expect(zkAppPublicKey).toBeDefined();
    if (!zkAppPublicKey) return;

    const element = new Element({
      key: Field(1),
      value1: Field(2),
      value2: Field(2),
    });
    const proof = await MyZkProgram.create(element);
    const ok = await verify(proof, verificationKeyZkProgram!);
    expect(ok).toBeTruthy();
    await fs.writeFile("./json/proof7.json", JSON.stringify(proof.toJSON()));
    await fs.writeFile("./json/vkzk.json", JSON.stringify({ verificationKey: verificationKeyZkProgram }));

    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppPublicKey });

    memory();
    const zkApp = new MySmartContract(zkAppPublicKey);
    const transaction = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        zkApp.mint(proof);
      }
    );
    //await transaction.prove();
    transaction.sign([deployer]);
    await fs.writeFile("./json/mytx4.json", transaction.toJSON());
  });
});

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
