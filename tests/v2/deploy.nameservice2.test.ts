import { describe, expect, it } from "@jest/globals";
import { PrivateKey, PublicKey, fetchAccount, UInt64, Mina } from "o1js";

import { MinaNFT } from "../../src/minanft";
import { NameContractV2 } from "../../src/contract-v2/nft";
import {
  initBlockchain,
  accountBalance,
  accountBalanceMina,
} from "../../src/mina";
import { Memory } from "../../src/mina";
import {
  CONTRACT_DEPLOYER_SK,
  MINANFT_NAME_SERVICE_V2_SK,
  NAMES_ORACLE_SK,
} from "../../env.json";
import config from "../../src/config";
const { MINANFT_NAME_SERVICE_V2, NAMES_ORACLE } = config;
import { MinaNFTNameServiceV2 as MinaNFTNameService } from "../../src/minanftnames2";
import { blockchain } from "../../src";

const chain: blockchain = "mainnet" as blockchain;
const useLocalBlockchain: boolean = chain === "local";

let deployer: PrivateKey | undefined = undefined;
let nameService: MinaNFTNameService | undefined = undefined;
let nameServicePrivateKey: PrivateKey | undefined = undefined;
let oraclePrivateKey: PrivateKey | undefined = undefined;

beforeAll(async () => {
  const data = await initBlockchain(chain);
  expect(data).toBeDefined();
  if (data === undefined) return;

  deployer = useLocalBlockchain
    ? data.keys[0].privateKey
    : PrivateKey.fromBase58(CONTRACT_DEPLOYER_SK);
  oraclePrivateKey = PrivateKey.fromBase58(NAMES_ORACLE_SK);
  nameServicePrivateKey = PrivateKey.fromBase58(MINANFT_NAME_SERVICE_V2_SK);
  if (
    nameServicePrivateKey.toPublicKey().toBase58() !== MINANFT_NAME_SERVICE_V2
  ) {
    throw new Error(`Invalid name service private key`);
  }

  expect(deployer).toBeDefined();
  if (deployer === undefined) return;
  const balanceDeployer =
    Number((await accountBalance(deployer.toPublicKey())).toBigInt()) / 1e9;
  expect(balanceDeployer).toBeGreaterThan(5);
  if (balanceDeployer <= 5) return;
  console.log("id", Mina.getNetworkId());
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
    const sender = deployer.toPublicKey();
    const deployerBalance = await accountBalanceMina(sender);
    console.log(`sender`, sender.toBase58());
    console.log(`deployer balance: ${deployerBalance}`);
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
