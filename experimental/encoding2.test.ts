import { describe, expect, it } from "@jest/globals";
import { Field } from "o1js";

// Helper function to convert BigInt to Uint8Array with a specific length
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

function stringToFields(str: string): Field[] {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  const fields: Field[] = [];

  for (let i = 0; i < bytes.length; i += 30) {
    const chunkSize = Math.min(30, bytes.length - i);
    const chunk = new Uint8Array(chunkSize + 1);
    chunk[0] = chunkSize; // The first byte is the length of the actual string chunk
    chunk.set(bytes.slice(i, i + chunkSize), 1);
    fields.push(Field.from(uint8ArrayToBigInt(chunk)));
  }

  return fields;
}

function fieldsToString(fields: Field[]): string {
  const decoder = new TextDecoder();
  let str = "";

  fields.forEach((field) => {
    const bigIntValue = field.toBigInt();
    // The first byte is the length, so shift right by 240 bits (30 bytes) to get it
    const length = Number(bigIntValue >> BigInt(240));
    const chunk = bigIntToUint8Array(bigIntValue, length + 1).slice(1); // Remove the length byte
    str += decoder.decode(chunk);
  });

  return str;
}

// Testing with Jest
describe("Convert string to Fields and back", () => {
  it("should convert string to Fields", () => {
    const str = "Hello, World!";
    const fields = stringToFields(str);

    // Expect the number of fields to be correct
    expect(fields.length).toBe(1);

    // The first field should contain the correct value
    const fieldData = fields[0].toBigInt();
    expect(fieldData).not.toBe(null);
  });

  it("should convert Fields to string", () => {
    const str = "Hello, World!";
    const fields = stringToFields(str);
    const convertedStr = fieldsToString(fields);

    expect(convertedStr).toBe(str);
  });
});
