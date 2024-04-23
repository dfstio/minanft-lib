import { describe, expect, it } from "@jest/globals";
import { PrivateKey, PublicKey, fetchAccount, UInt32, fetchEvents } from "o1js";

import { MinaNFT } from "../src/minanft";
import { MinaNFTNameService } from "../src/minanftnames";
import { initBlockchain, accountBalance } from "../utils/testhelpers";
import { Memory } from "../src/mina";
import {
  CONTRACT_DEPLOYER_SK,
  MINANFT_NAME_SERVICE_SK,
  NAMES_ORACLE_SK,
} from "../env.json";
import config from "../src/config";
const { MINANFT_NAME_SERVICE } = config;
import { MinaNFTNameServiceContract } from "../src/contract/names";

beforeAll(async () => {
  await MinaNFT.minaInit("berkeley");
  const deployer = PrivateKey.fromBase58(CONTRACT_DEPLOYER_SK);

  expect(deployer).toBeDefined();
  if (deployer === undefined) return;
  const balanceDeployer =
    Number((await accountBalance(deployer.toPublicKey())).toBigInt()) / 1e9;
  expect(balanceDeployer).toBeGreaterThan(15);
  if (balanceDeployer <= 15) return;
});

describe(`Deploy MinaNFT Name Service contract`, () => {
  /*
  it(`should compile contracts`, async () => {
    MinaNFT.setCacheFolder("./cache");
    console.log(`Compiling...`);
    console.time(`compiled all`);
    await MinaNFT.compile();
    console.timeEnd(`compiled all`);
    Memory.info(`compiled`);
  });
  */

  it(`should get Name Service contract events`, async () => {
    const address = PublicKey.fromBase58(MINANFT_NAME_SERVICE);
    console.log("Address", address.toBase58());
    const names = new MinaNFTNameServiceContract(address);
    await fetchAccount({ publicKey: address });
    //const events = await names.fetchEvents(UInt32.from(0));
    const events = await fetchEvents({
      publicKey: MINANFT_NAME_SERVICE,
    });
    expect(events).toBeDefined();
    if (events === undefined) return;
    console.log("Events", events);
  });
});
