import { describe, expect, it } from "@jest/globals";
import { NFTContractV2 } from "../../src/contract-v2/nft";
import { initBlockchain } from "../../src/mina";
import { blockchain } from "../../src";
import fs from "fs/promises";

const chain: blockchain = "devnet" as blockchain;
const useLocalBlockchain: boolean = (chain === "local") as boolean;

describe(`Deploy MinaNFT Name Service contract`, () => {
  it(`should get verification key`, async () => {
    await initBlockchain(useLocalBlockchain ? "local" : "devnet");
    const verificationKey = (await NFTContractV2.compile()).verificationKey;
    const json = {
      chain,
      hash: verificationKey.hash.toJSON(),
      data: verificationKey.data,
    };
    await fs.writeFile(
      `./json/vk.${chain}.json`,
      JSON.stringify(json, null, 2)
    );
  });
});
