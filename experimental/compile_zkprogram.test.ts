import { describe, expect, it } from "@jest/globals";
import {
  Field,
  SmartContract,
  state,
  State,
  method,
  ZkProgram,
  Struct,
  Cache,
} from "o1js";

jest.setTimeout(1000 * 60 * 60); // 1 hour

class Element extends Struct({
  key: Field,
  value1: Field,
  value2: Field,
}) {}

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
    await MyZkProgram.compile({ cache }); // { cache } argument is not supported
    console.timeEnd("compiled MyZkProgram");
    memory();
    console.time("compiled MySmartContract");
    await MySmartContract.compile({ cache });
    console.timeEnd("compiled MySmartContract");
    memory();
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
