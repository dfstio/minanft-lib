import { Poseidon as PoseidonBigint } from "./indexed-poseidon";
import {
  Bool,
  Field,
  Struct,
  Unconstrained,
  Provable,
  Poseidon,
  Option,
  ProvableExtended,
} from "o1js";
import { conditionalSwap, InferValue, assert } from "./indexed-helpers";

type IndexedMerkleMapBase = {
  root: Field;

  // (lower-level) method to insert a new leaf `(key, value)`. proves that `key` doesn't exist yet
  insert(key: Field, value: Field): void;

  // (lower-level) method to update an existing leaf `(key, value)`. proves that the `key` exists.
  update(key: Field, value: Field): void;

  // method that performs _either_ an insertion or update, depending on whether the key exists
  set(key: Field, value: Field): void;

  // method to get a value from a key. returns an option to account for the key not existing
  // note: this has to prove that the option's `isSome` is correct
  get(key: Field): { isSome: Bool; value: Field }; // the optional `Field` here is the value

  // optional / nice-to-have: remove a key and its value from the tree; proves that the key is included.
  // (implementation: leave a wasted leaf in place but skip it in the linked list encoding)
  // remove(key: Field): void;
};

type BaseLeaf = {
  key: Field;
  value: Field;
  nextKey: Field;
  nextIndex: Field;
};

export class Leaf extends Struct({
  value: Field,

  key: Field,
  nextKey: Field,

  index: Field,
  nextIndex: Field,

  sortedIndex: Unconstrained.provableWithEmpty(0),
}) {
  static hashNode({ key, value, nextKey, nextIndex }: BaseLeaf) {
    return Poseidon.hash([key, value, nextKey, nextIndex]);
  }

  static nextAfter(low: Leaf, leaf: BaseLeaf): Leaf {
    return {
      key: leaf.key,
      value: leaf.value,
      nextKey: leaf.nextKey,
      nextIndex: leaf.nextIndex,
      index: low.nextIndex,
      sortedIndex: Unconstrained.witness(() => low.sortedIndex.get() + 1),
    };
  }

  static toBigints(leaf: Leaf): LeafValue {
    return {
      key: leaf.key.toBigInt(),
      value: leaf.value.toBigInt(),
      nextKey: leaf.nextKey.toBigInt(),
      index: leaf.index.toBigInt(),
      nextIndex: leaf.nextIndex.toBigInt(),
    };
  }
}

export type LeafValue = {
  value: bigint;

  key: bigint;
  nextKey: bigint;

  index: bigint;
  nextIndex: bigint;
};

//class OptionField extends Option(Field) {}
export class LeafPair extends Struct({ low: Leaf, self: Leaf }) {}

export class IndexedMerkleMap implements IndexedMerkleMapBase {
  // data defining the provable interface of a tree
  root: Field;
  length: Field; // length of the leaves array
  readonly height: number;

  // the raw data stored in the tree, plus helper structures
  readonly data: Unconstrained<{
    // for every level, an array of hashes
    readonly nodes: (bigint | undefined)[][];

    // leaves sorted by key, with a linked list encoded by nextKey
    // we always have
    // sortedLeaves[0].key = 0
    // sortedLeaves[n-1].nextKey = Field.ORDER - 1
    // for i=0,...n-2, sortedLeaves[i].nextKey = sortedLeaves[i+1].key
    readonly sortedLeaves: LeafValue[];
  }>;

  /**
   * Creates a new, empty Indexed Merkle Map, given its height.
   */
  constructor(height: number) {
    assert(height > 0, "height must be positive");
    assert(
      height < 53,
      "height must be less than 53, so that we can use 64-bit floats to represent indices."
    );
    this.height = height;

    let nodes: (bigint | undefined)[][] = Array(height);
    for (let level = 0; level < height; level++) {
      nodes[level] = [];
    }

    let firstLeaf = {
      key: 0n,
      value: 0n,
      // maximum, which is always greater than any key that is a hash
      nextKey: Field.ORDER - 1n,
      index: 0n,
      nextIndex: 0n, // TODO: ok?
    };
    let firstNode = Leaf.hashNode(
      Leaf.fromValue({ ...firstLeaf, sortedIndex: Unconstrained.from(0) })
    );
    let root = Nodes.setLeafNode(nodes, 0, firstNode.toBigInt());
    this.root = Field(root);
    this.length = Field(1);

    this.data = Unconstrained.from({ nodes, sortedLeaves: [firstLeaf] });
  }

  insert(key: Field | bigint, value: Field | bigint) {
    key = Field(key);
    value = Field(value);

    // prove that the key doesn't exist yet by presenting a valid low node
    let low = Provable.witness(Leaf, () => this.findLeaf(key).low);
    this.proveInclusion(low, "Invalid low node (root)");
    low.key.assertLessThan(key, "Invalid low node (key)");

    // if the key does exist, we have lowNode.nextKey == key, and this line fails
    key.assertLessThan(low.nextKey, "Key already exists in the tree");

    // update low node
    let index = this.length;
    let newLow = { ...low, nextKey: key, nextIndex: index };
    this.root = this.computeRoot(newLow.index, Leaf.hashNode(newLow));
    this.setLeafUnconstrained(true, newLow);

    // create and append new leaf
    let leaf = Leaf.nextAfter(newLow, {
      key,
      value,
      nextKey: low.nextKey,
      nextIndex: low.nextIndex,
    });

    this.root = this.computeRoot(index, Leaf.hashNode(leaf));
    this.length = this.length.add(1);
    this.setLeafUnconstrained(false, leaf);
  }

  update(key: Field | bigint, value: Field | bigint) {
    key = Field(key);
    value = Field(value);

    // prove that the key exists by presenting a leaf that contains it
    let self = Provable.witness(Leaf, () => this.findLeaf(key).self);
    this.proveInclusion(self, "Key does not exist in the tree");
    self.key.assertEquals(key, "Invalid leaf (key)");

    // update leaf
    let newSelf = { ...self, value };
    this.root = this.computeRoot(self.index, Leaf.hashNode(newSelf));
    this.setLeafUnconstrained(true, newSelf);
  }

  set(key: Field | bigint, value: Field | bigint) {
    key = Field(key);
    value = Field(value);

    // prove whether the key exists or not, by showing a valid low node
    let { low, self } = Provable.witness(LeafPair, () => this.findLeaf(key));
    this.proveInclusion(low, "Invalid low node (root)");
    low.key.assertLessThan(key, "Invalid low node (key)");
    key.assertLessThanOrEqual(low.nextKey, "Invalid low node (next key)");

    // the key exists iff lowNode.nextKey == key
    let keyExists = low.nextKey.equals(key);

    // prove inclusion of this leaf if it exists
    this.proveInclusionIf(keyExists, self, "Invalid leaf (root)");
    assert(keyExists.implies(self.key.equals(key)), "Invalid leaf (key)");

    // the leaf's index depends on whether it exists
    let index = Provable.if(keyExists, low.nextIndex, this.length);

    // update low node, or leave it as is
    let newLow = { ...low, nextKey: key, nextIndex: index };
    this.root = this.computeRoot(low.index, Leaf.hashNode(newLow));
    this.setLeafUnconstrained(true, newLow);

    // update leaf, or append a new one
    let newLeaf = Leaf.nextAfter(newLow, {
      key,
      value,
      nextKey: Provable.if(keyExists, self.nextKey, low.nextKey),
      nextIndex: Provable.if(keyExists, self.nextIndex, low.nextIndex),
    });
    this.root = this.computeRoot(index, Leaf.hashNode(newLeaf));
    this.length = Provable.if(keyExists, this.length, this.length.add(1));
    this.setLeafUnconstrained(keyExists, newLeaf);
  }

  get(key: Field | bigint): { isSome: Bool; value: Field } {
    key = Field(key);

    // prove whether the key exists or not, by showing a valid low node
    let { low, self } = Provable.witness(LeafPair, () => this.findLeaf(key));
    this.proveInclusion(low, "Invalid low node (root)");
    low.key.assertLessThan(key, "Invalid low node (key)");
    key.assertLessThanOrEqual(low.nextKey, "Invalid low node (next key)");

    // the key exists iff lowNode.nextKey == key
    let keyExists = low.nextKey.equals(key);

    // prove inclusion of this leaf if it exists
    this.proveInclusionIf(keyExists, self, "Invalid leaf (root)");
    assert(keyExists.implies(self.key.equals(key)), "Invalid leaf (key)");

    return { isSome: keyExists, value: self.value };
  }

  // helper methods

  proveInclusion(leaf: Leaf, message?: string) {
    // TODO: here, we don't actually care about the index,
    // so we could add a mode where `computeRoot()` doesn't prove it
    let node = Leaf.hashNode(leaf);
    let root = this.computeRoot(leaf.index, node);
    root.assertEquals(this.root, message ?? "Leaf is not included in the tree");
  }

  proveInclusionIf(condition: Bool, leaf: Leaf, message?: string) {
    let node = Leaf.hashNode(leaf);
    let root = this.computeRoot(leaf.index, node);
    assert(
      condition.implies(root.equals(this.root)),
      message ?? "Leaf is not included in the tree"
    );
  }

  /**
   * Compute the root given a leaf node and its index.
   */
  computeRoot(index: Field, node: Field) {
    let indexU = Unconstrained.witness(() => Number(index.toBigInt()));
    let indexBits = index.toBits(this.height - 1);

    for (let level = 0; level < this.height - 1; level++) {
      // in every iteration, we witness a sibling and hash it to get the parent node
      let isRight = indexBits[level];
      let sibling = Provable.witness(Field, () => {
        let i = indexU.get();
        indexU.set(i >> 1);
        let isLeft = !isRight.toBoolean();
        let nodes = this.data.get().nodes;
        let sibling = Nodes.getNode(
          nodes,
          level,
          isLeft ? i + 1 : i - 1,
          false
        );
        return sibling;
      });
      let [right, left] = conditionalSwap(isRight, node, sibling);
      node = Poseidon.hash([left, right]);
    }
    // now, `node` is the root of the tree
    return node;
  }

  /**
   * Given a key, returns both the low node and the leaf that contains the key.
   *
   * If the key does not exist, a dummy value is returned for the leaf.
   *
   * Assumes to run outside provable code.
   */
  findLeaf(key_: Field | bigint): InferValue<typeof LeafPair> {
    let key = typeof key_ === "bigint" ? key_ : key_.toBigInt();
    assert(key >= 0n, "key must be positive");
    let leaves = this.data.get().sortedLeaves;

    // this case is typically invalid, but we want to handle it gracefully here
    // and reject it using comparison constraints
    if (key === 0n)
      return {
        low: Leaf.toValue(Leaf.empty()),
        self: { ...leaves[0], sortedIndex: Unconstrained.from(0) },
      };

    let { lowIndex, foundValue } = bisectUnique(
      key,
      (i) => leaves[i].key,
      leaves.length
    );
    let iLow = foundValue ? lowIndex - 1 : lowIndex;
    let low = { ...leaves[iLow], sortedIndex: Unconstrained.from(iLow) };

    let iSelf = foundValue ? lowIndex : 0;
    let selfBase = foundValue ? leaves[lowIndex] : Leaf.toBigints(Leaf.empty());
    let self = { ...selfBase, sortedIndex: Unconstrained.from(iSelf) };
    return { low, self };
  }

  /**
   * Update or append a leaf in our internal data structures
   */
  private setLeafUnconstrained(leafExists: Bool | boolean, leaf: Leaf) {
    Provable.asProver(() => {
      let { nodes, sortedLeaves } = this.data.get();

      // update internal hash nodes
      let i = Number(leaf.index.toBigInt());
      Nodes.setLeafNode(nodes, i, Leaf.hashNode(leaf).toBigInt());

      // update sorted list
      let leafValue = Leaf.toBigints(leaf);
      let iSorted = leaf.sortedIndex.get();

      if (Bool(leafExists).toBoolean()) {
        sortedLeaves[iSorted] = leafValue;
      } else {
        sortedLeaves.splice(iSorted, 0, leafValue);
      }
    });
  }
}

export type Nodes = (bigint | undefined)[][];
export namespace Nodes {
  /**
   * Sets the leaf node at the given index, updates all parent nodes and returns the new root.
   */
  export function setLeafNode(nodes: Nodes, index: number, leaf: bigint) {
    nodes[0][index] = leaf;
    let height = nodes.length;

    for (let level = 0; level < height - 1; level++) {
      let isLeft = index % 2 === 0;
      index = Math.floor(index / 2);

      let left = getNode(nodes, level, index * 2, isLeft);
      let right = getNode(nodes, level, index * 2 + 1, !isLeft);
      nodes[level + 1][index] = PoseidonBigint.hash([left, right]);
    }
    return getNode(nodes, height - 1, 0, true);
  }

  export function getNode(
    nodes: Nodes,
    level: number,
    index: number,
    nonEmpty: boolean
  ) {
    let node = nodes[level]?.[index];
    if (node === undefined) {
      if (nonEmpty)
        throw Error(
          `node at level=${level}, index=${index} was expected to be known, but isn't.`
        );
      node = empty(level);
    }
    return node;
  }

  // cache of empty nodes (=: zero leaves and nodes with only empty nodes below them)
  const emptyNodes = [0n];

  export function empty(level: number) {
    for (let i = emptyNodes.length; i <= level; i++) {
      let zero = emptyNodes[i - 1];
      emptyNodes[i] = PoseidonBigint.hash([zero, zero]);
    }
    return emptyNodes[level];
  }
}

// helper

/**
 * Bisect indices in an array of unique values that is sorted in ascending order.
 *
 * `getValue()` returns the value at the given index.
 *
 * We return
 * `lowIndex` := max { i in [0, length) | getValue(i) <= target }
 * `foundValue` := whether `getValue(lowIndex) == target`
 */
function bisectUnique(
  target: bigint,
  getValue: (index: number) => bigint,
  length: number
): {
  lowIndex: number;
  foundValue: boolean;
} {
  let [iLow, iHigh] = [0, length - 1];
  // handle out of bounds
  if (getValue(iLow) > target) return { lowIndex: -1, foundValue: false };
  if (getValue(iHigh) < target) return { lowIndex: iHigh, foundValue: false };

  // invariant: 0 <= iLow <= lowIndex <= iHigh < length
  // since we are either returning or reducing (iHigh - iLow), we'll eventually terminate correctly
  while (true) {
    if (iHigh === iLow) {
      return { lowIndex: iLow, foundValue: getValue(iLow) === target };
    }
    // either iLow + 1 = iHigh = iMid, or iLow < iMid < iHigh
    // in both cases, the range gets strictly smaller
    let iMid = Math.ceil((iLow + iHigh) / 2);
    if (getValue(iMid) <= target) {
      // iMid is in the candidate set, and strictly larger than iLow
      // preserves iLow <= lowIndex
      iLow = iMid;
    } else {
      // iMid is no longer in the candidate set, so we can exclude it right away
      // preserves lowIndex <= iHigh
      iHigh = iMid - 1;
    }
  }
}
