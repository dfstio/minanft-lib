export { TextData };
import { MerkleTree, Field } from "o1js";
import { BaseMinaNFTObject } from "../baseminanftobject";

class TextData extends BaseMinaNFTObject {
  height: number;
  size: number;
  text: string;

  constructor(text: string) {
    super("text");
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

  public toJSON(): object {
    return {
      type: this.type,
      MerkleTreeHeight: this.height,
      size: this.size,
      text: this.text,
    };
  }
  public static fromJSON(json: object): TextData {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = json as any;
    const data = obj.data;
    const kind = obj.kind;
    const linkedObject = obj.linkedObject;
    if (data === undefined)
      throw new Error("uri: NFT metadata: data should present");

    if (kind === undefined || typeof kind !== "string" || kind !== "text")
      throw new Error("uri: NFT metadata: kind mismatch");
    if (
      linkedObject === undefined ||
      typeof linkedObject !== "object" ||
      linkedObject.text === undefined ||
      typeof linkedObject.text !== "string" ||
      linkedObject.size === undefined ||
      linkedObject.MerkleTreeHeight === undefined ||
      linkedObject.type === undefined ||
      typeof linkedObject.type !== "string" ||
      linkedObject.type !== "text"
    )
      throw new Error("uri: NFT metadata: text json mismatch");
    const text = new TextData(linkedObject.text as string);
    if (text.root.toJSON() !== data)
      throw new Error("uri: NFT metadata: text root mismatch");
    if (text.size !== linkedObject.size)
      throw new Error("uri: NFT metadata: text size mismatch");
    if (text.height !== linkedObject.MerkleTreeHeight)
      throw new Error("uri: NFT metadata: text height mismatch");

    return text;
  }
}
