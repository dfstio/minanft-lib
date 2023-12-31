import { describe, expect, it } from "@jest/globals";
import { Field } from "o1js";
//import { stringToFields, stringFromFields } from "../src/conversions";
import { MinaNFT } from "../src/minanft";
import { makeString } from "../utils/testhelpers";

describe("Convert string to Fields and back", () => {
  let fields: Field[] = [];
  let str = "";

  const ipfs = `i:bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi`;
  it(`should convert ipfs hash to Fields`, async () => {
    fields = MinaNFT.stringToFields(ipfs);
    fields.forEach((field) => {
      expect(field.toBigInt()).toBeLessThanOrEqual(BigInt(32) << BigInt(248));
    });
    expect(fields.length).toBe(Math.ceil(ipfs.length / 31));
    expect(fields.length).toBe(2);
  });

  it(`should convert Fields to ipfs hash`, async () => {
    const recoveredString = MinaNFT.stringFromFields(fields);
    expect(recoveredString).toEqual(ipfs);
  });

  const arweave = `a:BTjZhINTpCtWiE0PcfpAQ8a3QhL-1AwXfNJ9lhbaJj0`;
  it(`should convert arweave hash to Fields`, async () => {
    fields = MinaNFT.stringToFields(arweave);
    fields.forEach((field) => {
      expect(field.toBigInt()).toBeLessThanOrEqual(BigInt(32) << BigInt(248));
    });
    expect(fields.length).toBe(Math.ceil(arweave.length / 31));
    expect(fields.length).toBe(2);
  });

  it(`should convert Fields to arweave hash`, async () => {
    const recoveredString = MinaNFT.stringFromFields(fields);
    expect(recoveredString).toEqual(arweave);
  });

  for (let i = 0; i < 10; i++) {
    it(`should generate string, iteration ${i}`, async () => {
      str = makeString(Math.floor(Math.random() * 1000) + 1);
    });

    it(`should convert string to Fields, iteration ${i}`, async () => {
      fields = MinaNFT.stringToFields(str);
      fields.forEach((field) => {
        expect(field.toBigInt()).toBeLessThanOrEqual(BigInt(32) << BigInt(248));
      });
      //expect(fields.length).toBe(Math.ceil(str.length / 31));
    });

    it(`should convert Fields to string, iteration ${i}`, async () => {
      const recoveredString = MinaNFT.stringFromFields(fields);
      expect(recoveredString).toEqual(str);
    });
  }

  it(`should convert Ethereum address to Field`, async () => {
    const address = "0xb3Edf83eA590F44f5c400077EBd94CCFE10E4Bb0";
    const field = Field.from(address);
    const recoveredAddress = "0x" + field.toBigInt().toString(16);
    console.log(recoveredAddress);
    expect(recoveredAddress.toLowerCase()).toEqual(address.toLowerCase());
  });
});
