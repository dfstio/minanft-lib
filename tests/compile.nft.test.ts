import { describe, expect, it } from "@jest/globals";
import { Mina } from "o1js";
import { MinaNFT } from "../src/minanft";
import { Memory } from "../src/mina";

const cacheDir = "./cache";

beforeAll(async () => {
  const Local = Mina.LocalBlockchain({ proofsEnabled: true });
  Mina.setActiveInstance(Local);
});

describe("Compile contracts", () => {
  MinaNFT.setCacheFolder(cacheDir);
  Memory.info("before compile");
  it("should compile a MinaNFT contract", async () => {
    console.time("compiled MinaNFT contract");
    await MinaNFT.compile();
    Memory.info("after MinaNFT contract");
    console.timeEnd("compiled MinaNFT contract");
    console.log(
      "Verification key hash is",
      MinaNFT.verificationKey?.hash.toJSON()
    );
    expect(MinaNFT.verificationKey).toBeDefined();
    // also in index.ts
    expect(MinaNFT.verificationKey?.hash.toJSON()).toBe(
      "14969286650042431830377273885790005239485927337964560228219347032689819548527"
    );
  });

  /*
  it("should list prover keys files", async () => {
    const files = await fs.readdir(cacheDir);
    const list = files.filter((f) => f.startsWith(".") === false);
    await fs.writeFile("./json/nftfiles.json", JSON.stringify(list, null, 2));
  });
  */
});
