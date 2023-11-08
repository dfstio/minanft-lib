export { TextData };
import { MerkleTree, Field } from "o1js";
import { BaseMinaNFTObject } from "../baseminanft";

class TextData extends BaseMinaNFTObject {
  height: number;
  size: number;
  text: string;

  constructor(text: string) {
    super();
    this.text = text;
    this.size = text.length;
    this.height = Math.ceil(Math.log2(this.size + 2)) + 1;
    const tree = new MerkleTree(this.height);
    if (this.size + 2 > tree.leafCount)
      throw new Error(`Text is too big for this Merkle tree`);
    tree.setLeaf(BigInt(0), Field.from(this.height));
    tree.setLeaf(BigInt(1), Field.from(this.size));
    for (let i = 0; i < this.size; i++) {
      tree.setLeaf(BigInt(i + 2), Field.from(this.text.charCodeAt(i)));
    }
    this.root = tree.getRoot();
  }
}
