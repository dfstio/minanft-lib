import { describe, expect, it } from "@jest/globals";
import { PrivateKey, PublicKey, fetchAccount, UInt64 } from "o1js";

import { MinaNFT } from "../../src/minanft";
import { NFTContractV2, NameContractV2 } from "../../src/contract-v2/nft";
import { initBlockchain, accountBalance } from "../../src/mina";
import { Memory } from "../../src/mina";
import {
  CONTRACT_DEPLOYER_SK,
  MINANFT_NAME_SERVICE_V2_SK,
  NAMES_ORACLE_SK,
} from "../../env.json";
import config from "../../src/config";
const { MINANFT_NAME_SERVICE_V2, NAMES_ORACLE } = config;
import { MinaNFTNameServiceV2 as MinaNFTNameService } from "../../src/minanftnames2";
import fs from "fs/promises";

// eslint-disable-next-line @typescript-eslint/no-inferrable-types
const useLocalBlockchain: boolean = false;

let deployer: PrivateKey | undefined = undefined;
let nameService: MinaNFTNameService | undefined = undefined;
let nameServicePrivateKey: PrivateKey | undefined = undefined;
let oraclePrivateKey: PrivateKey | undefined = undefined;

beforeAll(async () => {
  const data = await initBlockchain(useLocalBlockchain ? "local" : "devnet");
  expect(data).toBeDefined();
  if (data === undefined) return;

  deployer = useLocalBlockchain
    ? data.keys[0].privateKey
    : PrivateKey.fromBase58(CONTRACT_DEPLOYER_SK);
  oraclePrivateKey = PrivateKey.fromBase58(NAMES_ORACLE_SK);
  nameServicePrivateKey = PrivateKey.fromBase58(MINANFT_NAME_SERVICE_V2_SK);

  expect(deployer).toBeDefined();
  if (deployer === undefined) return;
  const balanceDeployer =
    Number((await accountBalance(deployer.toPublicKey())).toBigInt()) / 1e9;
  expect(balanceDeployer).toBeGreaterThan(15);
  if (balanceDeployer <= 15) return;
});

describe(`Deploy MinaNFT Name Service contract`, () => {
  it(`should deploy NameService`, async () => {
    expect(deployer).toBeDefined();
    if (deployer === undefined) return;
    expect(nameServicePrivateKey).toBeDefined();
    if (nameServicePrivateKey === undefined) return;
    expect(oraclePrivateKey).toBeDefined();
    if (oraclePrivateKey === undefined) return;
    const names = new MinaNFTNameService({
      oraclePrivateKey,
      priceLimit: UInt64.from(500_000_000_000),
    });
    const tx = await names.deploy(deployer, nameServicePrivateKey);
    expect(tx).toBeDefined();
    if (tx === undefined) return;
    Memory.info(`names service deployed`);
    expect(await MinaNFT.wait(tx)).toBe(true);
    nameService = names;
    expect(nameService).toBeDefined();
    if (nameService === undefined) return;
    expect(nameService.address).toBeDefined();
    if (nameService.address === undefined) return;
    expect(nameService.address.toBase58()).toBe(MINANFT_NAME_SERVICE_V2);
  });

  it(`should check Name Service contract`, async () => {
    expect(deployer).toBeDefined();
    if (deployer === undefined) return;
    expect(oraclePrivateKey).toBeDefined();
    if (oraclePrivateKey === undefined) return;
    const address = PublicKey.fromBase58(MINANFT_NAME_SERVICE_V2);
    const names = new NameContractV2(address);
    await fetchAccount({ publicKey: address });
    const oracle = names.oracle.get();
    expect(oracle).toBeDefined();
    if (oracle === undefined) return;
    expect(oracle.toBase58()).toBe(NAMES_ORACLE);
  });
});
