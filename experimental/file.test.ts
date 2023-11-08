import { describe, expect, it } from "@jest/globals";
import { File, FileData } from "../src/storage/file";
import { stringToFields } from "../src/conversions";
import { IPFS } from "../src/storage/ipfs";
import { PINATA_JWT } from "../env.json";

describe("Upload file to IPFS", () => {
  const filename: string = "./images/navigator.jpg";

  it(`should get file metadata`, async () => {
    const file = new File(filename);
    const metadata = await file.metadata();
    console.log("metadata", metadata, metadata.size / 31);
    const fields = stringToFields(metadata.sha512);
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
    const data: FileData = await file.data();
    console.log("File data", data);
    const ipfs = `i:bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi`;
    data.storage = ipfs;
    const { root, fields } = data.toFields();
    expect(data.root.toJSON()).toBe(
      "2793059465469543774426261406247381266701367422851648306638716756703027304636"
    );
    expect(fields.length).toBe(12);
    expect(root.toJSON()).toBe(
      "23135804848423275475338229695103818521415053410040749836833614379226435103097"
    );
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
