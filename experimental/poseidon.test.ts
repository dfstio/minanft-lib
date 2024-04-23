import { describe, expect, it } from "@jest/globals";
import {
  Poseidon,
  fetchAccount,
  PrivateKey,
  Mina,
  PublicKey,
  UInt64,
  Field,
} from "o1js";
import { MINAURL } from "../src/config.json";
import { DEPLOYER } from "../env.json";
//import { MinaNFT } from "../src/minanft";
const transactionFee = 150_000_000;

jest.setTimeout(1000 * 60 * 60); // 1 hour

let deployer: PrivateKey | undefined = undefined;
const useLocal: boolean = true;

beforeAll(async () => {
  if (useLocal) {
    const Local = await Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);
    const { privateKey } = Local.testAccounts[0];
    deployer = privateKey;
  } else {
    const network = Mina.Network(MINAURL);
    Mina.setActiveInstance(network);
    deployer = PrivateKey.fromBase58(DEPLOYER);
  }
  const balanceDeployer =
    Number((await accountBalance(deployer.toPublicKey())).toBigInt()) / 1e9;
  console.log(
    "Balance of the Deployer is ",
    balanceDeployer.toLocaleString("en")
  );
  expect(balanceDeployer).toBeGreaterThan(2);
  if (balanceDeployer <= 2) return;
});

describe("Poseidon hash test", () => {
  it("should calculate hash", async () => {
    for (let i = 0; i < 100; i++) {
      const a: Field[] = [];
      for (let j = 0; j < 200; j++) a.push(Field.random());
      let result1 = Poseidon.hash([a[0]]);
      for (let j = 1; j < 200; j++) {
        result1 = result1.add(Poseidon.hash([a[j]]));
      }
      let result2 = Poseidon.hash([a[0]]);
      for (let j = 1; j < 200; j++) {
        result2 = result2.add(Poseidon.hash([a[200 - j]]));
      }

      if (result1.toJSON() !== result2.toJSON()) {
        console.log(result1.toJSON());
        console.log(result2.toJSON());
      }
      expect(result1.toJSON()).toEqual(result2.toJSON());
    }
  });
});

async function accountBalance(address: PublicKey): Promise<UInt64> {
  let check = Mina.hasAccount(address);
  if (!check) {
    await fetchAccount({ publicKey: address });
    check = Mina.hasAccount(address);
    if (!check) return UInt64.from(0);
  }
  const balance = Mina.getBalance(address);
  return balance;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
