export { File, FileData, FILE_TREE_HEIGHT, FILE_TREE_ELEMENTS };
import { MerkleTree, Field, Encoding } from "o1js";
import fs from "fs/promises";
import { createHash } from "crypto";
import path from "path";
import mime from "mime";
import { BaseMinaNFTObject } from "../baseminanftobject";
import { RedactedTree } from "../redactedtree";
import { IPFS } from "./ipfs";
import { ARWEAVE } from "./arweave";
import Jimp from "jimp";

const FILE_TREE_HEIGHT = 5;
const FILE_TREE_ELEMENTS = 12;

class FileData extends BaseMinaNFTObject {
  fileRoot: Field;
  height: number;
  size: number;
  mimeType: string;
  sha3_512: string;
  filename: string;
  storage: string;

  constructor(value: {
    fileRoot: Field;
    height: number;
    size: number;
    mimeType: string;
    sha3_512: string;
    filename: string;
    storage: string;
    type?: string;
  }) {
    if (
      value.type === "map" ||
      value.type === "text" ||
      value.type === "string"
    )
      throw new Error(`FileData: wrong type: ${value.type}`);
    super(value.type ?? "file");
    this.fileRoot = value.fileRoot;
    this.height = value.height;
    this.size = value.size;
    this.mimeType = value.mimeType;
    this.sha3_512 = value.sha3_512;
    this.filename = value.filename;
    this.storage = value.storage;
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
    if (fields.length !== FILE_TREE_ELEMENTS)
      throw new Error(
        `FileData has wrong encoding, should be FILE_TREE_ELEMENTS (12) fields`
      );

    tree.fill(fields);
    return { tree, fields };
  }

  public toJSON(): object {
    return {
      type: this.type,
      fileMerkleTreeRoot: this.fileRoot.toJSON(),
      MerkleTreeHeight: this.height,
      size: this.size,
      mimeType: this.mimeType,
      SHA3_512: this.sha3_512,
      filename: this.filename,
      storage: this.storage,
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
      type: data.type,
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

class File {
  filename: string;
  storage: string;
  sha3_512_hash?: string;
  size?: number;
  mimeType?: string;
  root?: Field;
  height?: number;
  leavesNumber?: number;
  type: string;
  constructor(filename: string, type: string) {
    this.filename = filename;
    this.storage = "";
    if (type === "map" || type === "text" || type === "string")
      throw new Error(`File: wrong type: ${type}`);
    this.type = type;
  }
  public async metadata(): Promise<{
    size: number;
    mimeType: string;
  }> {
    const stat = await fs.stat(this.filename);
    const mimeType = mime.getType(this.filename);
    return {
      size: stat.size,
      mimeType: mimeType ?? "application/octet-stream",
    };
  }

  public async sha3_512(): Promise<string> {
    const file: fs.FileHandle = await fs.open(this.filename);
    const stream = file.createReadStream();
    const hash = createHash("SHA3-512");
    for await (const chunk of stream) {
      hash.update(chunk);
    }
    this.sha3_512_hash = hash.digest("base64");
    stream.close();
    return this.sha3_512_hash;
  }

  public async pin(
    pinataJWT: string | undefined,
    arweaveKey: string | undefined
  ): Promise<void> {
    if (pinataJWT === undefined && arweaveKey === undefined)
      throw new Error(`Pin failed: no pinataJWT or arweaveKey`);
    const metadata = await this.metadata();
    if (pinataJWT !== undefined) {
      const file: fs.FileHandle = await fs.open(this.filename);
      const stream = file.createReadStream();
      const ipfs = new IPFS(pinataJWT);
      const hash = await ipfs.pinFile(
        stream,
        path.basename(this.filename),
        metadata.size,
        metadata.mimeType
      );
      stream.close();
      if (hash === undefined) throw new Error(`IPFS pin failed`);
      this.storage = `i:${hash}`;
      this.size = metadata.size;
      this.mimeType = metadata.mimeType;
    } else if (arweaveKey !== undefined) {
      const arweave = new ARWEAVE(arweaveKey);
      const data = await fs.readFile(this.filename);
      const hash = await arweave.pinFile(
        data,
        path.basename(this.filename),
        metadata.size,
        metadata.mimeType
      );
      if (hash === undefined) throw new Error(`Arweave pin failed`);
      this.storage = `a:${hash}`;
      this.size = metadata.size;
      this.mimeType = metadata.mimeType;
    }
  }

  public async setMetadata(): Promise<void> {
    const metadata = await this.metadata();
    this.size = metadata.size;
    this.mimeType = metadata.mimeType;
  }

  public async binaryFields(): Promise<Field[]> {
    const fields: Field[] = [];
    let remainder: Uint8Array = new Uint8Array(0);

    const file: fs.FileHandle = await fs.open(this.filename);
    const stream = file.createReadStream();

    function fillFields(bytes: Uint8Array): void {
      let currentBigInt = BigInt(0);
      let bitPosition = BigInt(0);
      for (const byte of bytes) {
        currentBigInt += BigInt(byte) << bitPosition;
        bitPosition += BigInt(8);
        if (bitPosition === BigInt(248)) {
          fields.push(Field(currentBigInt.toString()));
          currentBigInt = BigInt(0);
          bitPosition = BigInt(0);
        }
      }
      if (Number(bitPosition) > 0) fields.push(Field(currentBigInt.toString()));
    }
    for await (const chunk of stream) {
      const bytes: Uint8Array = new Uint8Array(remainder.length + chunk.length);
      if (remainder.length > 0) bytes.set(remainder);
      bytes.set(chunk as Buffer, remainder.length);
      const fieldsNumber = Math.floor(bytes.length / 31);
      const chunkSize = fieldsNumber * 31;
      //const chunkFields = Encoding.bytesToFields(bytes.slice(0, chunkSize));
      //fields.push(...chunkFields);
      fillFields(bytes.slice(0, chunkSize));
      remainder = bytes.slice(chunkSize);
    }
    if (remainder.length > 0) fillFields(remainder);
    stream.close();
    return fields;
  }

  public async pngFields(): Promise<Field[]> {
    const fields: Field[] = [];
    const file = await fs.readFile(this.filename);
    const png = await Jimp.read(file);
    fields.push(Field(png.bitmap.width));
    fields.push(Field(png.bitmap.height));
    fields.push(Field(png.bitmap.data.length));
    for (let i = 0; i < png.bitmap.data.length; i += 4) {
      const value =
        BigInt(png.bitmap.data[i]) +
        (BigInt(png.bitmap.data[i + 1]) << BigInt(8)) +
        (BigInt(png.bitmap.data[i + 2]) << BigInt(16)) +
        (BigInt(png.bitmap.data[i + 3]) << BigInt(24));
      fields.push(Field(value));
    }
    return fields;
  }

  public async treeData(calculateRoot: boolean): Promise<{
    root: Field;
    height: number;
    leavesNumber: number;
  }> {
    if (calculateRoot === false) {
      this.root = Field(0);
      this.height = 0;
      this.leavesNumber = 0;
      return {
        root: this.root,
        height: this.height,
        leavesNumber: this.leavesNumber,
      };
    }
    const fields: Field[] =
      this.type === "png" ? await this.binaryFields() : await this.pngFields();

    const height = Math.ceil(Math.log2(fields.length + 2)) + 1;
    const tree = new MerkleTree(height);
    if (fields.length > tree.leafCount)
      throw new Error(`File is too big for this Merkle tree`);

    // First field is the height, second number is the number of fields
    tree.fill([Field.from(height), Field.from(fields.length), ...fields]);
    this.root = tree.getRoot();
    this.height = height;
    this.leavesNumber = fields.length;
    return { root: this.root, height, leavesNumber: this.leavesNumber };
  }

  public async data(): Promise<FileData> {
    if (this.storage === "") {
      const metadata = await this.metadata();
      this.size = metadata.size;
      this.mimeType = metadata.mimeType;
    }
    if (this.sha3_512_hash === undefined)
      throw new Error(`File: SHA3-512 hash not set`);
    if (this.size === undefined) throw new Error(`File: size not set`);
    if (this.mimeType === undefined) throw new Error(`File: MIME type not set`);
    if (this.root === undefined) throw new Error(`File: root not set`);
    if (this.height === undefined) throw new Error(`File: height not set`);
    if (this.leavesNumber === undefined)
      throw new Error(`File: leavesNumber not set`);
    if (
      this.leavesNumber !== 0 &&
      this.leavesNumber !== Math.ceil(this.size / 31)
    ) {
      console.log(`File: leavesNumber: ${this.leavesNumber}`);
      console.log(`File: size: ${this.size}`);
    }
    //const metadata = await this.metadata();
    //const sha3_512 = await this.sha3_512();
    //const treeData = await this.treeData();
    return new FileData({
      fileRoot: this.root,
      height: this.height,
      size: this.size,
      mimeType: this.mimeType.slice(0, 30),
      sha3_512: this.sha3_512_hash,
      filename: path.basename(this.filename).slice(0, 30),
      storage: this.storage,
      type: this.type,
    });
  }
}
