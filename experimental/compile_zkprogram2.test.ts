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
  MerkleMap,
  SelfProof,
} from "o1js";

jest.setTimeout(1000 * 60 * 60); // 1 hour

import { Metadata, MetadataWitness } from "../src/contract/metadata";

class MetadataMap {
  data: MerkleMap;
  kind: MerkleMap;

  constructor() {
    this.data = new MerkleMap();
    this.kind = new MerkleMap();
  }

  getRoot(): Metadata {
    return new Metadata({
      data: this.data.getRoot(),
      kind: this.kind.getRoot(),
    });
  }

  get(key: Field): Metadata {
    return new Metadata({
      data: this.data.get(key),
      kind: this.kind.get(key),
    });
  }

  set(key: Field, value: Metadata): void {
    this.data.set(key, value.data);
    this.kind.set(key, value.kind);
  }

  getWitness(key: Field): MetadataWitness {
    return new MetadataWitness({
      data: this.data.getWitness(key),
      kind: this.kind.getWitness(key),
    });
  }
}

class MetadataUpdate extends Struct({
  oldRoot: Metadata,
  newRoot: Metadata,
  key: Field,
  oldValue: Metadata,
  newValue: Metadata,
  witness: MetadataWitness,
}) {}

class MetadataTransition extends Struct({
  oldRoot: Metadata,
  newRoot: Metadata,
}) {
  static create(update: MetadataUpdate) {
    const [dataWitnessRootBefore, dataWitnessKey] =
      update.witness.data.computeRootAndKey(update.oldValue.data);
    update.oldRoot.data.assertEquals(dataWitnessRootBefore);
    dataWitnessKey.assertEquals(update.key);
    const [kindWitnessRootBefore, kindWitnessKey] =
      update.witness.kind.computeRootAndKey(update.oldValue.kind);
    update.oldRoot.kind.assertEquals(kindWitnessRootBefore);
    kindWitnessKey.assertEquals(update.key);

    const [dataWitnessRootAfter, _] = update.witness.data.computeRootAndKey(
      update.newValue.data
    );
    update.newRoot.data.assertEquals(dataWitnessRootAfter);
    const [kindWitnessRootAfter, __] = update.witness.kind.computeRootAndKey(
      update.newValue.kind
    );
    update.newRoot.kind.assertEquals(kindWitnessRootAfter);

    return new MetadataTransition({
      oldRoot: update.oldRoot,
      newRoot: update.newRoot,
    });
  }

  static merge(
    transition1: MetadataTransition,
    transition2: MetadataTransition
  ) {
    return new MetadataTransition({
      oldRoot: transition1.oldRoot,
      newRoot: transition2.newRoot,
    });
  }

  static assertEquals(
    transition1: MetadataTransition,
    transition2: MetadataTransition
  ) {
    Metadata.assertEquals(transition1.oldRoot, transition2.oldRoot);
    Metadata.assertEquals(transition1.newRoot, transition2.newRoot);
  }
}

const MinaNFTMetadataUpdate = ZkProgram({
  name: "MinaNFTMetadataUpdate",
  publicInput: MetadataTransition,

  methods: {
    update: {
      privateInputs: [MetadataUpdate],

      method(state: MetadataTransition, update: MetadataUpdate) {
        const computedState = MetadataTransition.create(update);
        MetadataTransition.assertEquals(computedState, state);
      },
    },

    merge: {
      privateInputs: [SelfProof, SelfProof],

      method(
        newState: MetadataTransition,
        proof1: SelfProof<MetadataTransition, void>,
        proof2: SelfProof<MetadataTransition, void>
      ) {
        proof1.verify();
        proof2.verify();

        Metadata.assertEquals(
          proof1.publicInput.newRoot,
          proof2.publicInput.oldRoot
        );
        Metadata.assertEquals(proof1.publicInput.oldRoot, newState.oldRoot);
        Metadata.assertEquals(proof2.publicInput.newRoot, newState.newRoot);
      },
    },
  },
});

class MinaNFTMetadataUpdateProof extends ZkProgram.Proof(
  MinaNFTMetadataUpdate
) {}

class MySmartContract extends SmartContract {
  @state(Field) key = State<Field>();
  @state(Field) value = State<Field>();

  @method mint(proof: MinaNFTMetadataUpdateProof) {
    proof.verify();
    this.key.set(proof.publicInput.newRoot.kind);
    this.value.set(proof.publicInput.newRoot.data);
  }
}

class Key extends SmartContract {
  @state(Field) key = State<Field>();

  @method mint(key: Field) {
    this.key.assertEquals(Field(0));
    this.key.set(key);
  }
}

describe("Compile a contract", () => {
  it("should compile a contract", async () => {
    const cache: Cache = Cache.FileSystem("./mycache");
    await Key.compile({ cache });
    memory();
    console.time("compiled MyZkProgram");
    await MinaNFTMetadataUpdate.compile(); // { cache } argument is not supported
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
