import { describe, expect, it } from "@jest/globals";
import { Field, Mina, PrivateKey, Signature } from "o1js";
import { initBlockchain } from "../../src/mina";
import { blockchain } from "../../src";

const chain: blockchain = "mainnet" as blockchain;

describe(`Deploy MinaNFT Name Service contract`, () => {
  it(`should get verification key`, async () => {
    await initBlockchain(chain);
    console.log("id", Mina.getNetworkId());
    const key = PrivateKey.random();
    const publicKey = key.toPublicKey();
    const signature = Signature.create(key, [Field(1), Field(2), Field(3)]);
    const ok = signature
      .verify(publicKey, [Field(1), Field(2), Field(3)])
      .toBoolean();
    console.log("ok", ok);
    expect(ok).toBe(true);
  });
});
