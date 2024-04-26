import { describe, expect, it } from "@jest/globals";
import { Mina, Field, Poseidon, PrivateKey, UInt32 } from "o1js";
import { MinaNFT } from "../src/minanft";

jest.setTimeout(1000 * 60 * 60 * 24); // 24 hour
const names = [
  "DFST",
  "NAME",
  "NAMES",
  "MINANFT",
  "ZERO",
  "BLOCK",
  "mDNS",
  "MinaDNS",
  "minaDNS",
  "MINADNS",
]; //"NFT",
const lNames = ["minanft", "socialcap", "staketab", "mario", "worker", "cloud"];

describe("Names", () => {
  it("should generate addresses", async () => {
    while (true) {
      const privateKey = PrivateKey.random();
      const publicKey: string = privateKey.toPublicKey().toBase58();

      // check is public keys ends on one of the names
      const name = names.find((n) => publicKey.endsWith(n));
      if (name !== undefined)
        console.log(`"${name}" "${publicKey}" "${privateKey.toBase58()}"`);
      const lName = lNames.find((n) => publicKey.toLowerCase().endsWith(n));
      if (lName !== undefined)
        console.log(`"${lName}" "${publicKey}" "${privateKey.toBase58()}"`);
    }
  });
});
