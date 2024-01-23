import { describe, expect, it } from "@jest/globals";
import {
  PrivateKey, PublicKey
} from "o1js";
import {
  blockchain,
  Memory,
  makeString,
  sleep,
  accountBalance,
  accountBalanceMina,
  initBlockchain
} from "../src/mina";

const useBlockchain: blockchain = "local";

let deployers: {
  publicKey: PublicKey;
  privateKey: PrivateKey;
}[] | undefined = undefined;

beforeAll(async () => {
  const data = initBlockchain(useBlockchain);
  expect(data).toBeDefined();
  if (data === undefined) return;
  deployers = data.keys;

});

describe("Check Mina utils", () => {
  Memory.info("start");
  it("should get account balance", async () => {
    expect(deployers).toBeDefined();
    if (deployers === undefined) return;
    const balance = await accountBalance(deployers[0].publicKey);
    expect(balance).toBeDefined();
    if (balance === undefined) return;
    expect(balance.toBigInt()).toBeGreaterThan(0);
    Memory.info("after account balance");
  });
  it("should get account balance in Mina", async () => {
    expect(deployers).toBeDefined();
    if (deployers === undefined) return;
    const balance = await accountBalanceMina(deployers[0].publicKey);
    expect(balance).toBeDefined();
    if (balance === undefined) return;
    expect(balance).toBeGreaterThan(0);
    Memory.info("after account balance in Mina");
  });
  it("should make string", async () => {
    const str = makeString(10);
    expect(str).toBeDefined();
    Memory.info("after make string");
  });
  it("should sleep", async () => {
    const time1 = Date.now();
    await sleep(1000);
    const time2 = Date.now();
    expect(time2 - time1).toBeGreaterThan(1000);
    Memory.info("after sleep");
  });
});
