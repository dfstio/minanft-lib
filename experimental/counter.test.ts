import { describe, expect, it } from "@jest/globals";
import {
  method,
  SmartContract,
  Mina,
  UInt64,
  state,
  State,
  Cache
} from "o1js";
import fs from "fs/promises";


class Counter extends SmartContract {
  @state(UInt64) counter = State<UInt64>();

  @method increaseCounter() {
    const counter = this.counter.getAndAssertEquals();
    this.counter.set(counter.add(UInt64.from(1)));
  }
}

const cacheDir = "./counter-cache";

beforeAll(async () => {
    const Local = Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);
});

describe("Compile Counter contract", () => {
  it("should compile a Counter contract", async () => {
    await listFiles(cacheDir);
    const cache: Cache = Cache.FileSystem(cacheDir);
    console.time("compiled Counter");
    const { verificationKey } = await Counter.compile({ cache });
    console.timeEnd("compiled Counter");
    console.log("verificationKey", verificationKey.hash.toJSON());
    await listFiles(cacheDir);
    const files = await fs.readdir("./nftcache");
    await fs.writeFile("./json/nftfiles.json", JSON.stringify(files,null,2));
    
  });
});

async function listFiles(folder: string) {
const files = await fs.readdir(folder);
console.log("files", files);
} 
