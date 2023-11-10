import { describe, expect, it } from "@jest/globals";
import { Mina, checkZkappTransaction } from "o1js";

describe("tx status", () => {
  it("should get tx status", async () => {
    Mina.setActiveInstance(
      Mina.Network("https://proxy.berkeley.minaexplorer.com")
    );

    while (true) {
      const txId = "5Juvghb6tyeEDx7QRxknUDajhtuFH2GPfzSKzh1FX7zENqgULHef";
      const status = await checkZkappTransaction(txId);
      console.log(status);
      await sleep(1000 * 60);
    }
  });
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
