import { describe, expect, it } from "@jest/globals";
import { Field } from "o1js";

const str = `Although it is possible to set the verification key inside the SmartContract’s method by passing the variable of the type VerificationKey to the method, it is not possible to set zkAppUri inside the SmartContract’s method by passing the variable of the type Types.ZkappUri to the method.`;
let fields: Field[] = [];

describe("Convert string to Fields and back", () => {
  it("should convert string to Fields", async () => {
    fields = stringToFields(str);
    console.log(fields.length);
    fields.forEach((field) => {
      expect(field.toBigInt()).toBeLessThanOrEqual(BigInt(31) << BigInt(240));
    });
  });

  it("should convert Fields to string", async () => {
    const str1 = stringFromFields(fields);
    expect(str1).toEqual(str);
  });
});

function bigIntToUint8Array(value: bigint, length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let i = length - 1; i >= 0; i--) {
    bytes[i] = Number(value & BigInt(0xff));
    value >>= BigInt(8);
  }
  return bytes;
}

// Helper function to convert Uint8Array to BigInt
function uint8ArrayToBigInt(bytes: Uint8Array): bigint {
  let value = BigInt(0);
  bytes.forEach((byte) => {
    value = (value << BigInt(8)) + BigInt(byte);
  });
  return value;
}

// convert string to chunks of 30 chars
function stringToFields(str: string): Field[] {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  const fields: Field[] = [];

  for (let i = 0; i < bytes.length; i += 30) {
    const chunkSize = Math.min(30, bytes.length - i);
    const chunk = new Uint8Array(31);
    chunk[0] = chunkSize; // The first byte is the length of the actual string chunk
    chunk.set(bytes.slice(i, i + chunkSize), 31 - chunkSize);
    fields.push(Field.from(uint8ArrayToBigInt(chunk)));
  }

  return fields;
}

// convert Field[] to string
function stringFromFields(fields: Field[]): string {
  const decoder = new TextDecoder();
  let str = "";

  fields.forEach((field) => {
    const bigIntValue = field.toBigInt();
    // The first byte is the length, so shift right by 240 bits (30 bytes) to get it
    const length = Number(bigIntValue >> BigInt(240));
    const chunk = bigIntToUint8Array(bigIntValue, length + 1).slice(1); // Remove the length byte
    const str1 = decoder.decode(chunk);
    str += str1;
  });

  return str;
}
