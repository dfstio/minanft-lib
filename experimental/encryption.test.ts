import crypto from "crypto";
import { ARWEAVE_ADDRESS, ARWEAVE_KEY_STRING } from "../env.json";

describe("Encryption utils", () => {
  it("should encrypt and decrypt", async () => {
    console.log("encrypt and decrypt");
    const text = ARWEAVE_KEY_STRING;
    const encrypted = await encryptString(text);
    console.log(encrypted);
    const decrypted = await decryptString({
      key: encrypted.key,
      iv: encrypted.iv,
      data: encrypted.data,
    });
    console.log(decrypted);
    expect(decrypted).toBe(text);
  });
});

export async function encryptString(data: string): Promise<{
  iv: string;
  key: string;
  data: string;
}> {
  const key = crypto.randomBytes(32); // Generate a random 32-byte key
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(key), iv);
  let encrypted = cipher.update(data);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return {
    iv: iv.toString("hex"),
    key: key.toString("hex"),
    data: encrypted.toString("hex"),
  };
}

export async function decryptString(params: {
  key: string;
  iv: string;
  data: string;
}): Promise<any> {
  try {
    let iv = Buffer.from(params.iv, "hex");
    const key = Buffer.from(params.key, "hex");
    let encryptedText = Buffer.from(params.data, "hex");
    let decipher = crypto.createDecipheriv("aes-256-cbc", key as Buffer, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error: any) {
    console.error(`Error: decryptString ${error}`);
  }
  return undefined;
}
