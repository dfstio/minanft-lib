import { describe, expect, it } from "@jest/globals";
import { Mina, fetchLastBlock } from "o1js";

describe("timestamp", () => {
  it("should get blockchain timestamp", async () => {
    Mina.setActiveInstance(
      Mina.Network("https://proxy.berkeley.minaexplorer.com/graphql")
    );
    const time = Date.now();
    console.log(`Current time: ${new Date(time).toISOString()}`);
    await fetchLastBlock();
    const state = Mina.getNetworkState().globalSlotSinceGenesis.toBigint();
    const epoch = Mina.getNetworkState().nextEpochData.epochLength.toBigint();
    const { genesisTimestamp, slotTime } =
      Mina.activeInstance.getNetworkConstants();
    console.log(state, epoch, genesisTimestamp.toBigInt(), slotTime.toBigInt());
    const current = Number(
      genesisTimestamp.toBigInt() + state * slotTime.toBigInt()
    );
    console.log(time, current, (time - current) / 1000 / 60 / 60 / 24);
    console.log(
      `genesisTimestamp time: ${new Date(
        Number(genesisTimestamp.toBigInt())
      ).toISOString()}`
    );
  });
});
