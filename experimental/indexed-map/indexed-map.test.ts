import { describe, expect, it } from "@jest/globals";
import {
  IndexedMerkleMap,
  LeafPair,
  Leaf,
  Nodes,
} from "../../src/contract-v2/indexed-map";
import { conditionalSwap } from "../../src/contract-v2/indexed-helpers";
import { makeString } from "../../src";
import {
  Field,
  Encoding,
  MerkleMap,
  MerkleMapWitness,
  ZkProgram,
  Struct,
  Provable,
  Unconstrained,
  verify,
  Poseidon,
} from "o1js";

const data: { key: Field; value: Field }[] = [];
const height = 11;
const MAP_SIZE = 10;
const PROOF_SIZE = 1;
const imap = new IndexedMerkleMap(height);
const map = new MerkleMap();

/* for 1000 elements: 3.5x faster 
indexed map fill: 15.550s
usual map fill: 54.647s 
*/

class LeafInclusion extends Struct({
  value: Field,
  key: Field,
  root: Field,
}) {}

/**
 * Compute the root given a leaf node and its index.
 */
function computeRoot(index: Field, node: Field) {
  let indexU = Unconstrained.witness(() => Number(index.toBigInt()));
  let indexBits = index.toBits(height - 1);

  for (let level = 0; level < height - 1; level++) {
    // in every iteration, we witness a sibling and hash it to get the parent node
    let isRight = indexBits[level];
    let sibling = Provable.witness(Field, () => {
      let i = indexU.get();
      indexU.set(i >> 1);
      let isLeft = !isRight.toBoolean();
      let nodes = imap.data.get().nodes;
      let sibling = Nodes.getNode(nodes, level, isLeft ? i + 1 : i - 1, false);
      return sibling;
    });
    let [right, left] = conditionalSwap(isRight, node, sibling);
    node = Poseidon.hash([left, right]);
  }
  // now, `node` is the root of the tree
  return node;
}

const IndexedMapInclusion = ZkProgram({
  name: "IndexedMapInclusion",
  publicInput: LeafInclusion,

  methods: {
    inclusion: {
      privateInputs: [Leaf],

      async method(data: LeafInclusion, leaf: Leaf) {
        data.value.assertEquals(leaf.value);
        //data.key.assertEquals(leaf.key);
        //const node = Leaf.hashNode(leaf);
        //const root = computeRoot(leaf.index, node);
        //data.root.assertEquals(root);
      },
    },
  },
});

const MapInclusion = ZkProgram({
  name: "MapInclusion",
  publicInput: LeafInclusion,

  methods: {
    inclusion: {
      privateInputs: [MerkleMapWitness],

      async method(data: LeafInclusion, witness: MerkleMapWitness) {
        const [root, key] = witness.computeRootAndKeyV2(data.value);
        data.root.assertEquals(root);
        data.key.assertEquals(key);
      },
    },
  },
});

describe(`Indexed Map`, () => {
  it(`should prepare data`, async () => {
    for (let i = 0; i < MAP_SIZE; i++) {
      const key = makeString(20);
      const value = Field.random();
      data.push({ key: Encoding.stringToFields(key)[0], value });
    }
  });
  it(`should fill-in indexed map`, async () => {
    console.time(`indexed map fill`);
    for (let i = 0; i < MAP_SIZE; i++) {
      imap.set(data[i].key, data[i].value);
    }
    console.timeEnd(`indexed map fill`);
  });
  it(`should prove inclusion on indexed map`, async () => {
    console.time(`compiled`);
    const { verificationKey } = await IndexedMapInclusion.compile();
    console.timeEnd(`compiled`);
    const methods = await IndexedMapInclusion.analyzeMethods();
    console.log("constraints", methods.inclusion.rows);
    console.time(`indexed map prove`);
    const key = data[0].key;
    const leafPair = imap.findLeaf(key);
    //console.log("leaf", leafPair.self);
    const leaf: Leaf = Leaf.fromValue(leafPair.self);
    const leafInclusion = new LeafInclusion({
      value: leaf.value,
      key: leaf.key,
      root: imap.root,
    });
    const proof = await IndexedMapInclusion.inclusion(leafInclusion, leaf);
    console.timeEnd(`indexed map prove`);
    const ok = await verify(proof, verificationKey);
    console.log("ok", ok);
    expect(ok).toBe(true);
  });

  it(`should fill-in usual map`, async () => {
    console.time(`usual map fill`);
    for (let i = 0; i < MAP_SIZE; i++) {
      map.set(data[i].key, data[i].value);
    }
    console.timeEnd(`usual map fill`);
  });

  it(`should prove inclusion on usual map`, async () => {
    console.time(`compiled`);
    const { verificationKey } = await MapInclusion.compile();
    console.timeEnd(`compiled`);
    const methods = await MapInclusion.analyzeMethods();
    console.log("constraints", methods.inclusion.rows);
    console.time(`map prove`);
    const key = data[0].key;
    const value = data[0].value;
    const root = map.getRoot();
    const leafInclusion = new LeafInclusion({
      value,
      key,
      root,
    });
    const witness = map.getWitness(key);

    const proof = await MapInclusion.inclusion(leafInclusion, witness);
    console.timeEnd(`map prove`);
    const ok = await verify(proof, verificationKey);
    console.log("ok", ok);
    expect(ok).toBe(true);
  });
});
