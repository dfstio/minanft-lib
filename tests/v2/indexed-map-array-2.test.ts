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

const height = 11;
class MerkleMap extends IndexedMerkleMap(height) {}
const data: { key: Field; value: Field }[] = [];

const MAP_SIZE = 1000;
const PROOF_SIZE = 10;
const imap = new IndexedMerkleMap(height);
const map = new MerkleMap();

/* for 1000 elements: 3.5x faster 
indexed map fill: 15.550s
usual map fill: 54.647s 

[5:29:37 PM] indexed map fill: 16.250s
[5:29:39 PM] compiled: 2.068s
[5:29:40 PM] constraints 1746
[5:29:52 PM] indexed map prove: 12.787s
[5:29:53 PM] ok true
[5:30:51 PM] usual map fill: 57.924s
[5:31:27 PM] compiled: 35.682s
[5:31:33 PM] constraints 42071
[5:31:56 PM] map prove: 23.363s
[5:31:57 PM] ok true

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
  publicInput: Provable.Array(LeafInclusion, PROOF_SIZE),

  methods: {
    inclusion: {
      privateInputs: [Provable.Array(Leaf, PROOF_SIZE)],

      async method(data: LeafInclusion[], leafs: Leaf[]) {
        for (let i = 0; i < PROOF_SIZE; i++) {
          data[i].value.assertEquals(leafs[i].value);
          data[i].key.assertEquals(leafs[i].key);
          const node = Leaf.hashNode(leafs[i]);
          const root = computeRoot(leafs[i].index, node);
          data[i].root.assertEquals(root);
        }
      },
    },
  },
});

const MapInclusion = ZkProgram({
  name: "MapInclusion",
  publicInput: Provable.Array(LeafInclusion, PROOF_SIZE),

  methods: {
    inclusion: {
      privateInputs: [Provable.Array(MerkleMapWitness, PROOF_SIZE)],

      async method(data: LeafInclusion[], witness: MerkleMapWitness[]) {
        for (let i = 0; i < PROOF_SIZE; i++) {
          const [root, key] = witness[i].computeRootAndKey(data[i].value);
          data[i].root.assertEquals(root);
          data[i].key.assertEquals(key);
        }
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
    const leafs: Leaf[] = [];
    const inclusions: LeafInclusion[] = [];
    for (let i = 0; i < PROOF_SIZE; i++) {
      const key = data[0].key;
      const leafPair = imap.findLeaf(key);
      const leaf: Leaf = Leaf.fromValue(leafPair.self);
      const leafInclusion = new LeafInclusion({
        value: leaf.value,
        key: leaf.key,
        root: imap.root,
      });
      leafs.push(leaf);
      inclusions.push(leafInclusion);
    }

    const proof = await IndexedMapInclusion.inclusion(inclusions, leafs);
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
    const inclusions: LeafInclusion[] = [];
    const witnesses: MerkleMapWitness[] = [];
    const root = map.getRoot();
    for (let i = 0; i < PROOF_SIZE; i++) {
      const key = data[0].key;
      const value = data[0].value;

      const leafInclusion = new LeafInclusion({
        value,
        key,
        root,
      });
      const witness = map.getWitness(key);
      inclusions.push(leafInclusion);
      witnesses.push(witness);
    }

    const proof = await MapInclusion.inclusion(inclusions, witnesses);
    console.timeEnd(`map prove`);
    const ok = await verify(proof, verificationKey);
    console.log("ok", ok);
    expect(ok).toBe(true);
  });
});
