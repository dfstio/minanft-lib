import { describe, expect, it } from "@jest/globals";
import fs from "fs/promises";
import {
  AccountUpdate,
  PrivateKey,
  Mina,
  PublicKey,
  UInt64,
  Types,
} from "o1js";

jest.setTimeout(1000 * 60 * 60 * 1); // 1 hour
const transactionFee = 150_000_000;
let senderPrivateKey: PrivateKey | undefined = undefined;
let senderPublicKey: PublicKey | undefined = undefined;

beforeAll(async () => {
  const Local = await Mina.LocalBlockchain({ proofsEnabled: true });
  Mina.setActiveInstance(Local);
  const { privateKey } = Local.testAccounts[0];
  senderPrivateKey = privateKey;
  senderPublicKey = senderPrivateKey.toPublicKey();
  expect(senderPublicKey).not.toBeUndefined();
  expect(senderPrivateKey).not.toBeUndefined();
});

describe("Sign, export, and import transaction", () => {
  it("should sign and export transaction", async () => {
    if (senderPublicKey === undefined || senderPrivateKey === undefined) return;
    const sender: PublicKey = senderPublicKey;
    const transaction = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        AccountUpdate.fundNewAccount(sender);
        const senderUpdate = AccountUpdate.create(sender);
        senderUpdate.requireSignature();
        senderUpdate.send({
          to: PrivateKey.random().toPublicKey(),
          amount: UInt64.from(1_000_000_000n),
        });
      }
    );
    // Sign BEFORE exporting
    transaction.sign([senderPrivateKey]);
    await fs.writeFile("./json/tx-signed.json", transaction.toJSON());
  });

  it("should send a signed transaction", async () => {
    const transaction: Mina.Transaction = Mina.Transaction.fromJSON(
      JSON.parse(
        await fs.readFile("./json/tx-signed.json", "utf8")
      ) as Types.Json.ZkappCommand
    ) as Mina.Transaction;
    console.log("transaction signed before export:", transaction.toPretty());
    const tx = await transaction.send();
    expect(tx.isSuccess).toBe(true);
  });
});

describe("Export, import and sign transaction", () => {
  it("should export unsigned transaction", async () => {
    if (senderPublicKey === undefined || senderPrivateKey === undefined) return;
    const sender: PublicKey = senderPublicKey;
    const transaction = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        AccountUpdate.fundNewAccount(sender);
        const senderUpdate = AccountUpdate.create(sender);
        senderUpdate.requireSignature();
        senderUpdate.send({
          to: PrivateKey.random().toPublicKey(),
          amount: UInt64.from(1_000_000_000n),
        });
      }
    );
    await fs.writeFile("./json/tx-unsigned.json", transaction.toJSON());
  });

  it("should import, sign and send transaction", async () => {
    const transaction: Mina.Transaction = Mina.Transaction.fromJSON(
      JSON.parse(
        await fs.readFile("./json/tx-unsigned.json", "utf8")
      ) as Types.Json.ZkappCommand
    ) as Mina.Transaction;
    expect(senderPrivateKey).not.toBeUndefined();
    if (senderPrivateKey === undefined) return;
    // Sign AFTER importing
    transaction.sign([senderPrivateKey]);
    console.log("transaction signed after import:", transaction.toPretty());
    const tx = await transaction.send();
    expect(tx.isSuccess).toBe(true);
  });
});
