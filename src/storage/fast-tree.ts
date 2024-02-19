import { Field, Poseidon } from "o1js";

type MerkleNodesMap = {
  [level: number]: {
    [nodes: string]: Field;
  };
};

type MerkleNode = {
  level: number;
  index: bigint;
  digest: Field;
};

class DynamicMerkleTree {
  private height: number;
  private nodes: MerkleNodesMap;
  protected zeroes: Field[];
  private size: number;

  constructor(height: number) {
    this.height = height;
    this.nodes = {};
    this.generateZeroes();
    this.size = 0;
  }

  private generateZeroes() {
    this.zeroes = new Array(this.height);
    this.zeroes[0] = Field(0);
    for (let i = 1; i < this.height; i += 1) {
      this.zeroes[i] = Poseidon.hash([this.zeroes[i - 1], this.zeroes[i - 1]]);
    }
  }

  private recalculateMerkleTree(newHeight: number) {
    if (newHeight <= this.height) {
      throw Error("New height must not be lower or equal to existed");
    }

    this.height = newHeight;

    this.generateZeroes();

    const levelZeroNodes = this.nodes[0];
    if (!levelZeroNodes) {
      return [];
    }

    const nodes = Object.entries(levelZeroNodes).map(([index, digest]) => ({
      level: 0,
      index: BigInt(index),
      digest,
    }));

    this.setLeaves(nodes);
  }

  public getRoot() {
    return this.getNode(this.height - 1, BigInt(0));
  }

  public setLeaves(leaves: MerkleNode[]) {
    if (this.size + leaves.length >= this.leafCount) {
      this.recalculateMerkleTree(this.height + 1);
    }

    let cacheSet = new Set<bigint>();

    for (let i = 0; i < leaves.length; i++) {
      const currentIndex = leaves[i].index;
      const parentIndex =
        (currentIndex - (currentIndex % BigInt(2))) / BigInt(2);
      cacheSet.add(parentIndex);

      this.setLeaf(currentIndex, leaves[i].digest);
    }

    for (let level = 1; level < this.height; level += 1) {
      const intermediateCacheSet = new Set<bigint>();

      intermediateCacheSet.clear();

      for (const currentIndex of cacheSet) {
        const parentIndex =
          (currentIndex - (currentIndex % BigInt(2))) / BigInt(2);
        intermediateCacheSet.add(parentIndex);

        const leftChild = this.getNode(level - 1, currentIndex * BigInt(2));
        const rightChild = this.getNode(
          level - 1,
          currentIndex * BigInt(2) + BigInt(1)
        );

        this.setNode({
          level,
          index: currentIndex,
          digest: Poseidon.hash([leftChild, rightChild]),
        });
      }

      cacheSet = intermediateCacheSet;
    }
  }

  public getNode(level: number, index: bigint): Field {
    return this.nodes[level]?.[index.toString()] ?? this.zeroes[level];
  }

  public isNodeExist(level: number, index: bigint): boolean {
    return !!this.nodes[level]?.[index.toString()];
  }

  public setNode(node: MerkleNode) {
    (this.nodes[node.level] ??= {})[node.index.toString()] = node.digest;
  }

  public setLeaf(index: bigint, digest: Field) {
    if (!this.isNodeExist(0, index)) {
      this.size += 1;
    }

    this.setNode({
      level: 0,
      index,
      digest,
    });
  }

  get leafCount() {
    return 2 ** (this.height - 1);
  }
}

export function calculateMerkleTreeRootFast(
  height: number,
  fields: Field[]
): { leafCount: number; root: Field } {
  const nodes: MerkleNode[] = [];
  const length = fields.length;
  for (let i = 0; i < length; i++) {
    nodes.push({ level: 0, index: BigInt(i), digest: fields[i] });
  }
  const tree: DynamicMerkleTree = new DynamicMerkleTree(height);
  tree.setLeaves(nodes);
  return { leafCount: tree.leafCount, root: tree.getRoot() };
}
