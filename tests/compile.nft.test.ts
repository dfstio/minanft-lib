import { describe, expect, it } from "@jest/globals";
import { Mina } from "o1js";
import { MinaNFT } from "../src/minanft";
import { Memory } from "../src/mina";
import fs from "fs/promises";

const cacheDir = "./nftcache";

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
  });

  it("should list prover keys files", async () => {
    const files = await fs.readdir(cacheDir);
    const list = files.filter((f) => f.startsWith(".") === false);
    await fs.writeFile("./json/nftfiles.json", JSON.stringify(list, null, 2));
  });
});
