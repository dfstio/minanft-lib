import { describe, expect, it } from "@jest/globals";
import { MinaNFT } from "../src/minanft";
import { PublicKey } from "o1js";
import { api } from "../src/api/api";
import { Memory } from "../src/mina";
import { JWT } from "../env.json";

describe(`MinaNFT mint using api`, () => {
  it(`should get NFT address by api call - existing NFT `, async () => {
    const minanft = new api(JWT);
    const result = await minanft.lookupName("@test_video");
    console.log("lookup result", result);
    expect(result.address).toBeDefined();
    if (result.address === undefined) return;
    const publicKey = PublicKey.fromBase58(result.address);
    console.log("publicKey", publicKey.toBase58());
    expect(result.success).toBe(true);
  });

  it(`should get NFT address by api call - non existing NFT `, async () => {
    const minanft = new api(JWT);
    const result = await minanft.lookupName("@i_do_not_exist");
    console.log("lookup result", result);
    expect(result.address).toBeUndefined();
    expect(result.reason).toBe("not found");
    expect(result.success).toBe(true);
  });
});
