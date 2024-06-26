import { describe, expect, it } from "@jest/globals";
import os from "os";
import {
  Field,
  fetchAccount,
  PrivateKey,
  Mina,
  PublicKey,
  UInt64,
  Poseidon,
  SmartContract,
  state,
  State,
  method,
  SelfProof,
  Experimental,
  Struct,
  MerkleMapWitness,
} from "o1js";

jest.setTimeout(1000 * 60 * 60); // 1 hour

class Key extends SmartContract {
  @state(Field) key = State<Field>();

  @method mint(key: Field) {
    this.key.assertEquals(Field(0));
    this.key.set(key);
  }
}

class MapElement extends Struct({
  originalRoot: Field,
  redactedRoot: Field,
  key: Field,
  value: Field,
  originalWitness: MerkleMapWitness,
  //redactedWitness: MerkleMapWitness,
}) {}

class RedactedMinaNFTMapState extends Struct({
  originalRoot: Field, // root of the original Map
  redactedRoot: Field, // root of the Redacted Map
  hash: Field, // hash of all the keys and values of the Redacted Map
  count: Field, // number of keys in the Redacted Map
}) {
  static create(element: MapElement, witness: MerkleMapWitness) {
    /*
    const [originalWitnessRoot, originalWitnessKey] =
      element.originalWitness.computeRootAndKeyV2(element.value);
    element.originalRoot.assertEquals(originalWitnessRoot);
    originalWitnessKey.assertEquals(element.key);

    const [redactedWitnessRoot, redactedWitnessKey] =
      element.redactedWitness.computeRootAndKeyV2(element.value);
    element.redactedRoot.assertEquals(redactedWitnessRoot);
    redactedWitnessKey.assertEquals(element.key);
    */

    return new RedactedMinaNFTMapState({
      originalRoot: element.originalRoot,
      redactedRoot: element.redactedRoot,
      hash: Poseidon.hash([element.key, element.value]),
      count: Field(1),
    });
  }

  static createEmpty(originalRoot: Field) {
    return new RedactedMinaNFTMapState({
      originalRoot: originalRoot,
      redactedRoot: Field(0),
      hash: Field(0),
      count: Field(0),
    });
  }

  static merge(
    state1: RedactedMinaNFTMapState,
    state2: RedactedMinaNFTMapState
  ) {
    state1.originalRoot.assertEquals(state2.originalRoot);
    state1.redactedRoot.assertEquals(state2.redactedRoot);

    return new RedactedMinaNFTMapState({
      originalRoot: state1.originalRoot,
      redactedRoot: state1.redactedRoot,
      hash: Poseidon.hash([state1.hash, state2.hash]),
      count: state1.count.add(state2.count),
    });
  }

  static assertEquals(
    state1: RedactedMinaNFTMapState,
    state2: RedactedMinaNFTMapState
  ) {
    state1.originalRoot.assertEquals(state2.originalRoot);
    state1.redactedRoot.assertEquals(state2.redactedRoot);
    state1.hash.assertEquals(state2.hash);
    state1.count.assertEquals(state2.count);
  }
}

const RedactedMinaNFTMapCalculation = Experimental.ZkProgram({
  publicInput: RedactedMinaNFTMapState,

  methods: {
    create: {
      privateInputs: [MapElement, MerkleMapWitness],

      method(
        state: RedactedMinaNFTMapState,
        element: MapElement,
        witness: MerkleMapWitness
      ) {
        const computedState = RedactedMinaNFTMapState.create(element, witness);
        RedactedMinaNFTMapState.assertEquals(computedState, state);
      },
    },

    createEmpty: {
      privateInputs: [Field],

      method(state: RedactedMinaNFTMapState, originalRoot: Field) {
        const computedState = RedactedMinaNFTMapState.createEmpty(originalRoot);
        RedactedMinaNFTMapState.assertEquals(computedState, state);
      },
    },

    merge: {
      privateInputs: [SelfProof, SelfProof],

      method(
        newState: RedactedMinaNFTMapState,
        proof1: SelfProof<RedactedMinaNFTMapState, void>,
        proof2: SelfProof<RedactedMinaNFTMapState, void>
      ) {
        proof1.verify();
        proof2.verify();
        const computedState = RedactedMinaNFTMapState.merge(
          proof1.publicInput,
          proof2.publicInput
        );
        RedactedMinaNFTMapState.assertEquals(computedState, newState);
      },
    },
  },
});

const RedactedMinaNFTMapStateProofClass = Experimental.ZkProgram.Proof(
  RedactedMinaNFTMapCalculation
);
class RedactedMinaNFTMapStateProof extends RedactedMinaNFTMapStateProofClass {}

describe("Compile a contract", () => {
  it("should compile a contract", async () => {
    console.log(
      "Compiling the contracts, free memory: ",
      os.freemem() / 1024 / 1024 / 1024
    );
    //await Key.compile();
    console.time("compiled");
    console.log("Compiling RedactedMinaNFTMapCalculation");
    await RedactedMinaNFTMapCalculation.compile();
    console.timeEnd("compiled");
  });
});
