import { describe, expect, it } from "@jest/globals";
import { Mina } from "o1js";
import { MinaNFT } from "../src/minanft";
import { Memory } from "../src/mina";

const cacheDir = "./cache";

beforeAll(async () => {
  const Local = await Mina.LocalBlockchain({ proofsEnabled: true });
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
      "9689101879662038518187439125596529724359011056818448961374724346336569336054"
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
