// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { describe, expect, it } from "@jest/globals";
import { Mina } from "o1js";
import { MinaNFT } from "../src/minanft";
import { Memory } from "../src/mina";

beforeAll(async () => {
  const Local = await Mina.LocalBlockchain({ proofsEnabled: true });
  Mina.setActiveInstance(Local);
});

describe("Compile contracts", () => {
  MinaNFT.setCacheFolder("./cache");
  Memory.info("before compile");

  it("should compile a Escrow contract", async () => {
    await MinaNFT.compileEscrow();
    Memory.info("after Escrow contract");
  });
  it("should compile a Badge contract", async () => {
    await MinaNFT.compileBadge();
    Memory.info("after Badge contract");
  });
  it("should compile a RedactedMap contract", async () => {
    await MinaNFT.compileRedactedMap();
    Memory.info("after RedactedMap contract");
  });
  it("should compile a Verifier contract", async () => {
    await MinaNFT.compileVerifier();
    Memory.info("after Verifier contract");
  });
});
