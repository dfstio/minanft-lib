export { FileData, FileDataType, FILE_TREE_HEIGHT, FILE_TREE_ELEMENTS };
import { MerkleTree, Field, Encoding } from "o1js";
import { BaseMinaNFTObject } from "../baseminanftobject";
import { RedactedTree } from "../redactedtree";

const FILE_TREE_HEIGHT = 5;
const FILE_TREE_ELEMENTS = 14;
type FileDataType = "binary" | "png" | "word";

class FileData extends BaseMinaNFTObject {
  fileRoot: Field;
  height: number;
  size: number;
  mimeType: string;
  sha3_512: string;
  filename: string;
  storage: string;
  fileType?: FileDataType;
  metadata?: Field;

  constructor(value: {
    fileRoot: Field;
    height: number;
    size: number;
    mimeType: string;
    sha3_512: string;
    filename: string;
    storage: string;
    fileType?: FileDataType;
    metadata?: Field;
  }) {
    super("file");
    this.fileRoot = value.fileRoot;
    this.height = value.height;
    this.size = value.size;
    this.mimeType = value.mimeType;
    this.sha3_512 = value.sha3_512;
    this.filename = value.filename;
    this.storage = value.storage;
    this.fileType = value.fileType ?? "binary";
    this.metadata = value.metadata ?? Field(0);
    const tree = this.buildTree().tree;
    this.root = tree.getRoot();
  }

  public buildTree(): { tree: MerkleTree; fields: Field[] } {
    const tree = new MerkleTree(FILE_TREE_HEIGHT);
    if (Number(tree.leafCount) < FILE_TREE_ELEMENTS)
      throw new Error(
        `FileData has wrong encoding, should be at least FILE_TREE_ELEMENTS (12) leaves`
      );
    const fields: Field[] = [];
    // First field is the height, second number is the number of fields
    fields.push(Field.from(FILE_TREE_HEIGHT)); // 0
    fields.push(Field.from(FILE_TREE_ELEMENTS)); // Number of data fields // 1

    fields.push(this.fileRoot); //2
    fields.push(Field.from(this.height)); //3
    fields.push(Field.from(this.size)); //4
    const mimeTypeFields = Encoding.stringToFields(
      this.mimeType.substring(0, 30)
    );
    if (mimeTypeFields.length !== 1)
      throw new Error(
        `FileData: MIME type string is too long, should be less than 30 bytes`
      );
    fields.push(mimeTypeFields[0]); //5
    const sha512Fields = Encoding.stringToFields(this.sha3_512);
    if (sha512Fields.length !== 3)
      throw new Error(`SHA512 has wrong encoding, should be base64`);
    fields.push(...sha512Fields); // 6,7,8
    const filenameFields = Encoding.stringToFields(
      this.filename.substring(0, 30)
    );
    if (filenameFields.length !== 1)
      throw new Error(
        `FileData: Filename string is too long, should be less than 30 bytes`
      );
    fields.push(filenameFields[0]); // 9
    const storageFields: Field[] =
      this.storage === ""
        ? [Field(0), Field(0)]
        : Encoding.stringToFields(this.storage);
    if (storageFields.length !== 2)
      throw new Error(`Storage string has wrong encoding`);
    fields.push(...storageFields); // 10, 11
    const fileType = this.fileType ?? "binary";
    const fileTypeFields = Encoding.stringToFields(fileType.substring(0, 30));
    if (fileTypeFields.length !== 1)
      throw new Error(
        `FileData: fileType string is too long, should be less than 30 bytes`
      );
    fields.push(...fileTypeFields); // 12
    const metadata: Field = this.metadata ?? Field(0);
    fields.push(metadata); // 13
    if (fields.length !== FILE_TREE_ELEMENTS)
      throw new Error(
        `FileData has wrong encoding, should be FILE_TREE_ELEMENTS (14) fields`
      );

    tree.fill(fields);
    return { tree, fields };
  }

  public toJSON(): object {
    const metadata: Field = this.metadata ?? Field(0);
    return {
      fileMerkleTreeRoot: this.fileRoot.toJSON(),
      MerkleTreeHeight: this.height,
      size: this.size,
      mimeType: this.mimeType,
      SHA3_512: this.sha3_512,
      filename: this.filename,
      storage: this.storage,
      fileType: this.fileType ?? "binary",
      metadata: metadata.toJSON(),
    };
  }
  public static fromJSON(json: object): FileData {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = json as any;
    const data = obj.linkedObject;
    if (data === undefined)
      throw new Error(`uri: NFT metadata: data should be present: ${json}`);
    if (data.fileMerkleTreeRoot === undefined)
      throw new Error(
        `uri: NFT metadata: fileMerkleTreeRoot should be present: ${json}`
      );
    if (data.MerkleTreeHeight === undefined)
      throw new Error(
        `uri: NFT metadata: MerkleTreeHeight should be present: ${json}`
      );
    if (data.size === undefined)
      throw new Error(`uri: NFT metadata: size should be present: ${json}`);
    if (data.mimeType === undefined)
      throw new Error(`uri: NFT metadata: mimeType should be present: ${json}`);
    if (data.SHA3_512 === undefined)
      throw new Error(`uri: NFT metadata: SHA3_512 should be present: ${json}`);
    if (data.filename === undefined)
      throw new Error(`uri: NFT metadata: filename should be present: ${json}`);
    if (data.storage === undefined)
      throw new Error(`uri: NFT metadata: storage should be present: ${json}`);

    return new FileData({
      fileRoot: Field.fromJSON(data.fileMerkleTreeRoot),
      height: Number(data.MerkleTreeHeight),
      size: Number(data.size),
      mimeType: data.mimeType,
      sha3_512: data.SHA3_512,
      filename: data.filename,
      storage: data.storage,
      fileType: data.fileType ?? "binary",
      metadata: data.metadata ? Field.fromJSON(data.metadata) : Field(0),
    });
  }

  public async proof(verbose?: boolean) {
    const { tree, fields } = this.buildTree();
    if (fields.length !== FILE_TREE_ELEMENTS)
      throw new Error(`FileData: proof: wrong number of fields`);
    const redactedTree = new RedactedTree(FILE_TREE_HEIGHT, tree);
    for (let i = 0; i < fields.length; i++) {
      redactedTree.set(i, fields[i]);
    }
    const proof = await redactedTree.proof(verbose);
    return proof;
  }
}
