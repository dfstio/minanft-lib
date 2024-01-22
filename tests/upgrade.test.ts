import { describe, expect, it } from "@jest/globals";
import { MinaNFT } from "../src/minanft";
import { MinaNFTNameService } from "../src/minanftnames";
import { PublicKey, PrivateKey } from "o1js";
import {  blockchain } from "../src/mina"
import {  initBlockchain } from "../utils/testhelpers"
import { Memory } from "../src/mina";
import { MINANFT_NAME_SERVICE_SK } from "../env.json";
import config from "../src/config";
const { MINANFT_NAME_SERVICE } = config;

const blockchainInstance: blockchain = 'local';

let deployer: PrivateKey | undefined = undefined;

beforeAll(async () => {
  const data = await initBlockchain(blockchainInstance, 0);
  expect(data).toBeDefined();
  if (data === undefined) return;

  const { deployer: d } = data;
  deployer = d;
  expect(deployer).toBeDefined();
  if (deployer === undefined) return;
});

describe(`Upgrade MinaNFT name service contract`, () => {
  it(`should compile contracts`, async () => {
    MinaNFT.setCacheFolder("./nftcache");
    console.log(`Compiling...`);
    console.time(`compiled all`);
    await MinaNFT.compile();
    console.timeEnd(`compiled all`);
    Memory.info(`compiled`);
  });

  it(`should upgrade NameService`, async () => {
    expect(deployer).toBeDefined();
    if (deployer === undefined) return;
    const oraclePrivateKey = PrivateKey.fromBase58(MINANFT_NAME_SERVICE_SK);
    const names = new MinaNFTNameService({
      address: PublicKey.fromBase58(MINANFT_NAME_SERVICE),
      oraclePrivateKey,
    });
    
    const txDeploy = await names.deploy(deployer);
    expect(txDeploy).toBeDefined();
    if (txDeploy === undefined) return;
    Memory.info(`names service deployed`);
    expect(await MinaNFT.wait(txDeploy)).toBe(true);
    
    /*
    const tx = await names.upgrade(
      deployer,
      PrivateKey.fromBase58(MINANFT_NAME_SERVICE_SK)
    );
    expect(tx).toBeDefined();
    if (tx === undefined) return;
    Memory.info(`names service upgraded`);
    expect(await MinaNFT.wait(tx)).toBe(true);
    */
  });
});
