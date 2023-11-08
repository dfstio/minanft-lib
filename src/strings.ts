export { stringToFields, stringFromFields };
import { Field } from "o1js";

/**
 * Convert string to Fields
 * @param str string to convert
 * @returns string converted to Field[]
 */
function stringToFields(str: string): Field[] {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  const fields: Field[] = [];

  for (let i = 0; i < bytes.length; i += 31) {
    const chunkSize = Math.min(31, bytes.length - i);
    const chunk = new Uint8Array(32);
    chunk[0] = chunkSize; // The first byte is the length of the actual string chunk
    chunk.set(bytes.slice(i, i + chunkSize), 32 - chunkSize);
    const value = uint8ArrayToBigInt(chunk);
    if (value >= Field.ORDER)
      throw new Error("stringToFields: value too large to fit into Field");
    fields.push(Field.from(value));
  }

  return fields;
}

/**
 * Convert Field[] to string
 * @param fields Field[] to convert to string
 * @returns string converted from Field[]
 */
function stringFromFields(fields: Field[]): string {
  const decoder = new TextDecoder();
  let str = "";

  fields.forEach((field) => {
    const bigIntValue = field.toBigInt();
    // The first byte is the length, so shift right by 248 bits (31 bytes) to get it
    const length = Number(bigIntValue >> BigInt(248));
    const chunk = bigIntToUint8Array(bigIntValue, length + 1).slice(1); // Remove the length byte
    const str1 = decoder.decode(chunk);
    str += str1;
  });

  return str;
}

// Helper function to convert BigInt to Uint8Array
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
