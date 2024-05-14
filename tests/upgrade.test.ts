import { describe, expect, it } from "@jest/globals";
import { MinaNFT } from "../src/minanft";
import { MinaNFTNameService } from "../src/minanftnames";
import { PublicKey, PrivateKey } from "o1js";
import { blockchain } from "../src/networks";
import { initBlockchain } from "../utils/testhelpers";
import { Memory } from "../src/mina";
import { MINANFT_NAME_SERVICE_SK } from "../env.json";
import config from "../src/config";
const { MINANFT_NAME_SERVICE } = config;

const chain: blockchain = "local" as blockchain;

let deployer: PrivateKey | undefined = undefined;

beforeAll(async () => {
  const data = await initBlockchain(chain, 0);
  expect(data).toBeDefined();
  if (data === undefined) return;

  const { deployer: d } = data;
  deployer = d;
  expect(deployer).toBeDefined();
  if (deployer === undefined) return;
});

describe(`Upgrade MinaNFT name service contract`, () => {
  it(`should check addresses`, async () => {
    const privateKey = PrivateKey.fromBase58(MINANFT_NAME_SERVICE_SK);
    const publicKey = PublicKey.fromBase58(MINANFT_NAME_SERVICE);
    expect(privateKey.toPublicKey().toBase58()).toBe(publicKey.toBase58());
  });

  it(`should compile contracts`, async () => {
    MinaNFT.setCacheFolder("./cache");
    console.log(`Compiling...`);
    console.time(`compiled all`);
    await MinaNFT.compile();
    console.timeEnd(`compiled all`);
    Memory.info(`compiled`);
  });

  if (chain === "local") {
    it(`should deploy NameService`, async () => {
      expect(deployer).toBeDefined();
      if (deployer === undefined) return;
      const oraclePrivateKey = PrivateKey.fromBase58(MINANFT_NAME_SERVICE_SK);
      const names = new MinaNFTNameService({
        address: PublicKey.fromBase58(MINANFT_NAME_SERVICE),
        oraclePrivateKey,
      });

      const txDeploy = await names.deploy(
        deployer,
        PrivateKey.fromBase58(MINANFT_NAME_SERVICE_SK)
      );
      expect(txDeploy).toBeDefined();
      if (txDeploy === undefined) return;
      Memory.info(`names service deployed`);
      expect(await MinaNFT.wait(txDeploy)).toBe(true);
    });
  }

  it(`should upgrade NameService`, async () => {
    expect(deployer).toBeDefined();
    if (deployer === undefined) return;
    const oraclePrivateKey = PrivateKey.fromBase58(MINANFT_NAME_SERVICE_SK);
    const names = new MinaNFTNameService({
      address: PublicKey.fromBase58(MINANFT_NAME_SERVICE),
      oraclePrivateKey,
    });

    const tx = await names.upgrade(
      deployer,
      PrivateKey.fromBase58(MINANFT_NAME_SERVICE_SK)
    );
    expect(tx).toBeDefined();
    if (tx === undefined) return;
    Memory.info(`names service upgraded`);
    expect(await MinaNFT.wait(tx)).toBe(true);
  });
});
