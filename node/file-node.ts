export { File, FileDataType };
import { MerkleTree, Field, Encoding } from "o1js";
import fs from "fs/promises";
import { createHash } from "crypto";
import path from "path";
import mime from "mime";
import { IPFS } from "../src/storage/ipfs";
import { ARWEAVE } from "../src/storage/arweave";
import Jimp from "jimp";
import { calculateMerkleTreeRootFast } from "../src/storage/fast-tree";
import { FileDataType, FileData } from "../src/storage/file";

class File {
  filename: string;
  storage: string;
  sha3_512_hash?: string;
  size?: number;
  mimeType?: string;
  root?: Field;
  height?: number;
  leavesNumber?: number;
  fileType: FileDataType;
  fileMetadata: Field;
  constructor(filename: string, fileType?: FileDataType, fileMetadata?: Field) {
    this.filename = filename;
    this.storage = "";
    this.fileType = fileType ?? "binary";
    this.fileMetadata = fileMetadata ?? Field(0);
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

  public async pin(params: {
    pinataJWT?: string;
    arweaveKey?: string;
    keyvalues?: object;
  }): Promise<string> {
    const { pinataJWT, arweaveKey, keyvalues } = params;
    if (pinataJWT === undefined && arweaveKey === undefined)
      throw new Error(`Pin failed: no pinataJWT or arweaveKey`);
    const metadata = await this.metadata();
    if (pinataJWT !== undefined) {
      const file: fs.FileHandle = await fs.open(this.filename);
      const stream = file.createReadStream();
      const ipfs = new IPFS(pinataJWT);
      const hash = await ipfs.pinFile({
        stream,
        name: path.basename(this.filename),
        size: metadata.size,
        mimeType: metadata.mimeType,
        keyvalues: keyvalues ?? { project: "MinaNFT" },
      });
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
    return this.storage;
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

  public static fillFields(bytes: Uint8Array): Field[] {
    const fields: Field[] = [];
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

  public async treeData(
    calculateRoot: boolean,
    fastCalculation: boolean = true
  ): Promise<{
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
      this.fileType === "png"
        ? await this.pngFields()
        : await this.binaryFields();

    const height = Math.ceil(Math.log2(fields.length + 2)) + 1;
    this.height = height;
    this.leavesNumber = fields.length;
    const treeFields = [
      Field.from(height),
      Field.from(fields.length),
      ...fields,
    ];

    if (fastCalculation) {
      const { leafCount, root } = calculateMerkleTreeRootFast(
        height,
        treeFields
      );
      if (treeFields.length > leafCount)
        throw new Error(`File is too big for this Merkle tree`);
      this.root = root;
      return { root, height, leavesNumber: this.leavesNumber };
    } else {
      const tree = new MerkleTree(height);
      if (treeFields.length > tree.leafCount)
        throw new Error(`File is too big for this Merkle tree`);

      // First field is the height, second number is the number of fields
      tree.fill(treeFields);
      this.root = tree.getRoot();
      return { root: this.root, height, leavesNumber: this.leavesNumber };
    }
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
      fileType: this.fileType,
      metadata: this.fileMetadata,
    });
  }
}
