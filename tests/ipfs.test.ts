import { describe, expect, it } from "@jest/globals";
import { IPFS } from "../src/storage/ipfs";
import { File } from "../src/storage/file";

import { PINATA_JWT } from "../env.json";

const filename = "./images/navigator.jpg";

describe("IPFS", () => {
  it("should pin JSON to IPFS", async () => {
    const ipfs = new IPFS(PINATA_JWT);
    const data = { text: "hello world" };
    const hash = await ipfs.pinJSON({
      data,
      name: "test.json",
      keyvalues: { key1: "test1", key2: "test2", project: "MinaNFT" },
    });
    expect(hash).toBeDefined();
    if (hash === undefined) return;
    console.log(`JSON pinned to https://ipfs.io/ipfs/${hash}`);
  });

  it("should pin file to IPFS", async () => {
    const file = new File(filename);
    const hash = await file.pin({
      pinataJWT: PINATA_JWT,
      keyvalues: { project: "MinaNFT", key1: "test1", key2: "test2" },
    });
    expect(hash).toBeDefined();
    if (hash === undefined) return;
    console.log(`hash:`, hash);
    console.log(`File pinned to https://ipfs.io/ipfs/${hash.substring(2)}`);
  });
});
