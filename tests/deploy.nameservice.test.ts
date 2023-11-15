import { describe, expect, it } from "@jest/globals";
import { PrivateKey, PublicKey, fetchAccount } from "o1js";

import { MinaNFT } from "../src/minanft";
import { MinaNFTNameService } from "../src/minanftnames";
import { Memory, initBlockchain, accountBalance } from "../utils/testhelpers";
import {
  CONTRACT_DEPLOYER_SK,
  MINANFT_NAME_SERVICE_SK,
  NAMES_ORACLE_SK,
} from "../env.json";
import { MINANFT_NAME_SERVICE, NAMES_ORACLE } from "../src/config.json";
import { MinaNFTNameServiceContract } from "../src/contract/names";

const useLocalBlockchain: boolean = false;

let deployer: PrivateKey | undefined = undefined;
let namesService: MinaNFTNameService | undefined = undefined;
let namesServicePrivateKey: PrivateKey | undefined = undefined;
let oraclePrivateKey: PrivateKey | undefined = undefined;

beforeAll(async () => {
  const data = await initBlockchain(
    useLocalBlockchain ? "local" : "testworld2",
    0
  );
  expect(data).toBeDefined();
  if (data === undefined) return;

  const { deployer: d } = data;
  deployer = useLocalBlockchain
    ? d
    : PrivateKey.fromBase58(CONTRACT_DEPLOYER_SK);
  oraclePrivateKey = PrivateKey.fromBase58(NAMES_ORACLE_SK);
  namesServicePrivateKey = PrivateKey.fromBase58(MINANFT_NAME_SERVICE_SK);

  expect(deployer).toBeDefined();
  if (deployer === undefined) return;
  const balanceDeployer =
    Number((await accountBalance(deployer.toPublicKey())).toBigInt()) / 1e9;
  expect(balanceDeployer).toBeGreaterThan(15);
  if (balanceDeployer <= 15) return;
});

describe(`Deploy MinaNFT Name Service contract`, () => {
  it(`should compile contracts`, async () => {
    console.log(`Compiling...`);
    console.time(`compiled all`);
    await MinaNFT.compile();
    console.timeEnd(`compiled all`);
    Memory.info(`compiled`);
  });
  /*
  it(`should deploy NameService`, async () => {
    expect(deployer).toBeDefined();
    if (deployer === undefined) return;
    expect(namesServicePrivateKey).toBeDefined();
    if (namesServicePrivateKey === undefined) return;
    expect(oraclePrivateKey).toBeDefined();
    if (oraclePrivateKey === undefined) return;
    const names = new MinaNFTNameService({
      oraclePrivateKey,
    });
    const tx = await names.deploy(deployer, namesServicePrivateKey);
    expect(tx).toBeDefined();
    if (tx === undefined) return;
    Memory.info(`names service deployed`);
    expect(await MinaNFT.wait(tx)).toBe(true);
    namesService = names;
    expect(namesService).toBeDefined();
    if (namesService === undefined) return;
    expect(namesService.address).toBeDefined();
    if (namesService.address === undefined) return;
    expect(namesService.address.toBase58()).toBe(MINANFT_NAME_SERVICE);
  });
*/
  it(`should check Name Service contract`, async () => {
    expect(deployer).toBeDefined();
    if (deployer === undefined) return;
    expect(oraclePrivateKey).toBeDefined();
    if (oraclePrivateKey === undefined) return;
    const address = PublicKey.fromBase58(MINANFT_NAME_SERVICE);
    const names = new MinaNFTNameServiceContract(address);
    await fetchAccount({ publicKey: address });
    const oracle = names.oracle.get();
    expect(oracle).toBeDefined();
    if (oracle === undefined) return;
    expect(oracle.toBase58()).toBe(NAMES_ORACLE);
  });
});
