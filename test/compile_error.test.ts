import { describe, expect, it } from "@jest/globals";
import {
  Field,
  SmartContract,
  state,
  State,
  method,
  ZkProgram,
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
  redactedWitness: MerkleMapWitness,
}) {}

class MapState extends Struct({
  originalRoot: Field,
  redactedRoot: Field,
}) {
  static create(element: MapElement) {
    return new MapState({
      originalRoot: element.originalRoot,
      redactedRoot: element.redactedRoot,
    });
  }

  static assertEquals(state1: MapState, state2: MapState) {
    state1.originalRoot.assertEquals(state2.originalRoot);
    state1.redactedRoot.assertEquals(state2.redactedRoot);
  }
}

const MapCalculation = ZkProgram({
  name: "MapCalculation",
  publicInput: MapState,

  methods: {
    create: {
      privateInputs: [MapElement],

      method(state: MapState, element: MapElement) {
        const computedState = MapState.create(element);
        MapState.assertEquals(computedState, state);
      },
    },
  },
});

describe("Compile a contract", () => {
  it("should compile a contract", async () => {
    //await Key.compile();
    await MapCalculation.compile();
  });
});
