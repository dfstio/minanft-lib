export { File, FileData };
import { MerkleTree, Field } from "o1js";
import fs from "fs/promises";
import { createHash } from "crypto";
import path from "path";
import mime from "mime";
import { bytesToFields, stringToFields } from "../conversions";
import { BaseMinaNFTObject } from "../baseminanft";
import { IPFS } from "./ipfs";

class FileData extends BaseMinaNFTObject {
  fileRoot: Field;
  height: number;
  size: number;
  mimeType: string;
  sha512: string;
  filename: string;
  storage: string;

  constructor(value: {
    fileRoot: Field;
    height: number;
    size: number;
    mimeType: string;
    sha512: string;
    filename: string;
    storage: string;
  }) {
    super();
    this.fileRoot = value.fileRoot;
    this.height = value.height;
    this.size = value.size;
    this.mimeType = value.mimeType;
    this.sha512 = value.sha512;
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
    const mimeTypeFields = stringToFields(this.mimeType);
    if (mimeTypeFields.length !== 1)
      throw new Error(
        `FileData: MIME type string is too long, should be less than 32 bytes`
      );
    fields.push(mimeTypeFields[0]);
    const sha512Fields = stringToFields(this.sha512);
    if (sha512Fields.length !== 3)
      throw new Error(`SHA512 has wrong encoding, should be base64`);
    fields.push(...sha512Fields);
    const filenameFields = stringToFields(this.filename);
    if (filenameFields.length !== 1)
      throw new Error(
        `FileData: Filename string is too long, should be less than 32 bytes`
      );
    fields.push(filenameFields[0]);
    const storageFields = stringToFields(this.storage);
    if (storageFields.length !== 2)
      throw new Error(`Storage string has wrong encoding`);
    fields.push(...storageFields);
    if (fields.length !== 12)
      throw new Error(`FileData has wrong encoding, should be 12 fields`);
    tree.fill(fields);
    this.root = tree.getRoot();
  }
}

class File {
  filename: string;
  storage?: string;
  constructor(filename: string) {
    this.filename = filename;
  }
  public async metadata(): Promise<{
    sha512: string;
    size: number;
    mimeType: string;
  }> {
    const stat = await fs.stat(this.filename);
    const file: fs.FileHandle = await fs.open(this.filename);
    const mimeType = mime.getType(this.filename);
    const stream = file.createReadStream();
    const hash = createHash("sha512");
    for await (const chunk of stream) {
      hash.update(chunk);
    }
    const sha512 = hash.digest("base64");
    return {
      sha512,
      size: stat.size,
      mimeType: mimeType ?? "application/octet-stream",
    };
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
      fields.push(...bytesToFields(bytes.slice(0, chunkSize)));
      remainder = bytes.slice(chunkSize);
    }
    if (remainder.length > 0) fields.push(...bytesToFields(remainder));

    const height = Math.ceil(Math.log2(fields.length + 2)) + 1;
    const tree = new MerkleTree(height);
    if (fields.length > tree.leafCount)
      throw new Error(`File is too big for this Merkle tree`);
    // First field is the height, second number is the number of fields
    tree.fill([Field.from(height), Field.from(fields.length), ...fields]);
    return { root: tree.getRoot(), height, leavesNumber: fields.length };
  }

  public async data(): Promise<FileData> {
    if (this.storage === undefined) throw new Error(`File: storage not set`);
    const metadata = await this.metadata();
    const treeData = await this.treeData();
    return new FileData({
      fileRoot: treeData.root,
      height: treeData.height,
      size: metadata.size,
      mimeType: metadata.mimeType.slice(0, 31),
      sha512: metadata.sha512,
      filename: path.basename(this.filename).slice(0, 31),
      storage: this.storage,
    });
  }
}
