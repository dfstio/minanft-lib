export {
  blockchain,
  initBlockchain,
  Memory,
  makeString,
  sleep,
  accountBalance,
  accountBalanceMina,
};

import { Mina, PublicKey, UInt64, fetchAccount } from "o1js";
import {
  MINAURL,
  ARCHIVEURL,
  TESTWORLD2,
  TESTWORLD2_ARCHIVE,
} from "../src/config.json";

type blockchain = "local" | "berkeley" | "testworld2" | "mainnet";

function initBlockchain(instance: blockchain): void {
  if (instance === "local") {
    const Local = Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);
  } else if (instance === "berkeley" || instance === "testworld2") {
    const network = Mina.Network(
      instance === "berkeley"
        ? {
            mina: MINAURL,
            archive: ARCHIVEURL,
          }
        : {
            mina: TESTWORLD2,
            archive: TESTWORLD2_ARCHIVE,
          }
    );
    Mina.setActiveInstance(network);
  } else {
    throw new Error("Mainnet is not supported yet.");
  }
}

async function accountBalance(address: PublicKey): Promise<UInt64> {
  await fetchAccount({ publicKey: address });
  if (Mina.hasAccount(address)) return Mina.getBalance(address);
  else return UInt64.from(0);
}

async function accountBalanceMina(address: PublicKey): Promise<number> {
  return Number((await accountBalance(address)).toBigInt()) / 1e9;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeString(length: number): string {
  let outString: string = ``;
  const inOptions: string = `abcdefghijklmnopqrstuvwxyz0123456789`;

  for (let i = 0; i < length; i++) {
    outString += inOptions.charAt(Math.floor(Math.random() * inOptions.length));
  }

  return outString;
}

class Memory {
  static rss: number = 0;
  constructor() {
    Memory.rss = 0;
  }

  public static info(description: string = ``) {
    const memoryData = process.memoryUsage();
    const formatMemoryUsage = (data: any) =>
      `${Math.round(data / 1024 / 1024)} MB`;
    const oldRSS = Memory.rss;
    Memory.rss = Math.round(memoryData.rss / 1024 / 1024);
    /*
    const memoryUsage = {
      rssDelta: `${oldRSS === 0 ? 0 : Memory.rss - oldRSS} MB`,
      rss: `${formatMemoryUsage(
        memoryData.rss
      )} -> Resident Set Size - total memory allocated`,
      heapTotal: `${formatMemoryUsage(
        memoryData.heapTotal
      )} -> total size of the allocated heap`,
      heapUsed: `${formatMemoryUsage(
        memoryData.heapUsed
      )} -> actual memory used during the execution`,
      external: `${formatMemoryUsage(
        memoryData.external
      )} -> V8 external memory`,
    };
    */

    console.log(
      `RSS memory ${description}: ${formatMemoryUsage(memoryData.rss)}${
        oldRSS === 0
          ? ``
          : `, changed by ` + (Memory.rss - oldRSS).toString() + ` MB`
      }`
    );
  }
}
