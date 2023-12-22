export { File, FileData };
import { MerkleTree, Field, Encoding } from "o1js";
import fs from "fs/promises";
import { createHash } from "crypto";
import path from "path";
import mime from "mime";
import { BaseMinaNFTObject } from "../baseminanftobject";
import { IPFS } from "./ipfs";

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
  }) {
    super("file");
    this.fileRoot = value.fileRoot;
    this.height = value.height;
    this.size = value.size;
    this.mimeType = value.mimeType;
    this.sha3_512 = value.sha3_512;
    this.filename = value.filename;
    this.storage = value.storage;
    const treeHeight = 5;
    const tree = new MerkleTree(treeHeight);
    const fields: Field[] = [];
    // First field is the height, second number is the number of fields
    fields.push(Field.from(treeHeight));
    fields.push(Field.from(10)); // Number of data fields

    fields.push(this.root);
    fields.push(Field.from(this.height));
    fields.push(Field.from(this.size));
    const mimeTypeFields = Encoding.stringToFields(
      this.mimeType.substring(0, 30)
    );
    if (mimeTypeFields.length !== 1)
      throw new Error(
        `FileData: MIME type string is too long, should be less than 30 bytes`
      );
    fields.push(mimeTypeFields[0]);
    const sha512Fields = Encoding.stringToFields(this.sha3_512);
    if (sha512Fields.length !== 3)
      throw new Error(`SHA512 has wrong encoding, should be base64`);
    fields.push(...sha512Fields);
    const filenameFields = Encoding.stringToFields(
      this.filename.substring(0, 30)
    );
    if (filenameFields.length !== 1)
      throw new Error(
        `FileData: Filename string is too long, should be less than 30 bytes`
      );
    fields.push(filenameFields[0]);
    const storageFields: Field[] =
      this.storage === ""
        ? [Field(0), Field(0)]
        : Encoding.stringToFields(this.storage);
    if (storageFields.length !== 2)
      throw new Error(`Storage string has wrong encoding`);
    fields.push(...storageFields);
    if (fields.length !== 12)
      throw new Error(`FileData has wrong encoding, should be 12 fields`);
    tree.fill(fields);
    this.root = tree.getRoot();
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
    if (data.type !== "file")
      throw new Error(`uri: NFT metadata: type mismatch: ${json}`);
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
    });
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
  constructor(filename: string) {
    this.filename = filename;
    this.storage = "";
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

  public async pin(pinataJWT: string) {
    const metadata = await this.metadata();
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
  }

  public async treeData(): Promise<{
    root: Field;
    height: number;
    leavesNumber: number;
  }> {
    const fields: Field[] = [];
    let remainder: Uint8Array = new Uint8Array(0);

    const file: fs.FileHandle = await fs.open(this.filename);
    const stream = file.createReadStream();
    for await (const chunk of stream) {
      const bytes: Uint8Array = new Uint8Array(remainder.length + chunk.length);
      if (remainder.length > 0) bytes.set(remainder);
      bytes.set(chunk as Buffer, remainder.length);
      const chunkSize = Math.floor(bytes.length / 31) * 31;
      fields.push(...Encoding.bytesToFields(bytes.slice(0, chunkSize)));
      remainder = bytes.slice(chunkSize);
    }
    if (remainder.length > 0) fields.push(...Encoding.bytesToFields(remainder));

    const height = Math.ceil(Math.log2(fields.length + 2)) + 1;
    const tree = new MerkleTree(height);
    if (fields.length > tree.leafCount)
      throw new Error(`File is too big for this Merkle tree`);
    // First field is the height, second number is the number of fields
    tree.fill([Field.from(height), Field.from(fields.length), ...fields]);
    this.root = tree.getRoot();
    this.height = height;
    this.leavesNumber = fields.length;
    stream.close();
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
    });
  }
}
