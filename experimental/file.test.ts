import { describe, expect, it } from "@jest/globals";
import { File, FileData } from "../src/storage/file";
import { MinaNFT } from "../src/minanft";
import { IPFS } from "../src/storage/ipfs";
import { PINATA_JWT } from "../env.json";

describe("Upload file to IPFS", () => {
  const filename: string = "./images/navigator.jpg";

  it(`should get file metadata`, async () => {
    const file = new File(filename);
    const metadata = await file.metadata();
    console.log("metadata", metadata, metadata.size / 31);
    const sha512 = await file.sha512();
    const fields = MinaNFT.stringToFields(sha512);
    expect(fields.length).toBe(3);
  });
  /*
  it(`should get file Merkle Tree root`, async () => {
    const file = new File(filename);
    const metadata = await file.metadata();
    const treeData = await file.treeData();
    console.log("Merkle Tree", treeData, treeData.root.toJSON());
    expect(treeData.leavesNumber).toBe(Math.ceil(metadata.size / 31));
    expect(treeData.root.toJSON()).toBe(
      "4877510576426769242071610850972125726279375364176951701298179994157421867921"
    );
  });
*/
  it(`should get file data`, async () => {
    const file = new File(filename);
    const ipfs = `i:bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi`;
    file.storage = ipfs;
    const data: FileData = await file.data();
    console.log("File data", data);
    console.log("File root", data.fileRoot.toJSON());
    console.log("root", data.root.toJSON());
  });

  /*
  it(`should upload file to IPFS`, async () => {
    const file = new File(filename);
    const metadata = await file.metadata();
    const stream = await file.read();
    expect(stream).toBeDefined();
    const ipfs = new IPFS(PINATA_JWT);
    const hash = await ipfs.pinFile(
      stream,
      filename,
      metadata.size,
      metadata.mimeType!
    );
    stream.close();
    expect(hash).not.toBe(undefined);
    if (hash === undefined) return;
    console.log(`File pinned to https://ipfs.io/ipfs/${hash}`);
  });
  */
});
