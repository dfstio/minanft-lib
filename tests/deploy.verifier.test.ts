import { describe, expect, it } from "@jest/globals";
import { PrivateKey } from "o1js";

import { MinaNFT } from "../src/minanft";
import { RedactedMinaNFT } from "../src/redactedminanft";
import { initBlockchain, accountBalance } from "../utils/testhelpers";
import { Memory } from "../src/mina";
import { CONTRACT_DEPLOYER_SK, VERIFIER_SK } from "../env.json";
import { CONTRACT_DEPLOYER, VERIFIER } from "../src/config.json";

// eslint-disable-next-line @typescript-eslint/no-inferrable-types
const useLocalBlockchain: boolean = false;

let deployer: PrivateKey | undefined = undefined;

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

  //MinaNFT.minaInit("testworld2");
  //deployer = PrivateKey.fromBase58(CONTRACT_DEPLOYER_SK);
  expect(deployer).toBeDefined();
  if (deployer === undefined) return;
  const balanceDeployer =
    Number((await accountBalance(deployer.toPublicKey())).toBigInt()) / 1e9;
  expect(balanceDeployer).toBeGreaterThan(15);
  if (balanceDeployer <= 15) return;
});

describe(`MinaNFT contract`, () => {
  it(`should check addresses`, async () => {
    expect(deployer).toBeDefined();
    if (deployer === undefined) return;
    if (!useLocalBlockchain) {
      expect(CONTRACT_DEPLOYER_SK).toBe(deployer.toBase58());
      expect(CONTRACT_DEPLOYER).toBe(deployer.toPublicKey().toBase58());
    }

    expect(VERIFIER).toBe(
      PrivateKey.fromBase58(VERIFIER_SK).toPublicKey().toBase58()
    );
  });

  it(`should deploy MinaNFTVerifier`, async () => {
    expect(deployer).toBeDefined();
    if (deployer === undefined) return;
    const verifierPrivateKey = PrivateKey.fromBase58(VERIFIER_SK);
    const tx = await RedactedMinaNFT.deploy(deployer, verifierPrivateKey);
    expect(tx).toBeDefined();
    if (tx === undefined) return;
    Memory.info(`verifier deployed`);
    expect(await MinaNFT.wait(tx)).toBe(true);
  });
});
