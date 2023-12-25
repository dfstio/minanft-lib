export {
  blockchain,
  initBlockchain,
  Memory,
  makeString,
  sleep,
  accountBalance,
  accountBalanceMina,
  formatTime,
};

import { Mina, PublicKey, PrivateKey, UInt64, fetchAccount } from "o1js";
import config from "../src/config";
const { MINAURL, ARCHIVEURL, TESTWORLD2, TESTWORLD2_ARCHIVE } = config;

type blockchain = "local" | "berkeley" | "testworld2" | "mainnet";

function initBlockchain(instance: blockchain):
  | {
      publicKey: PublicKey;
      privateKey: PrivateKey;
    }[]
  | undefined {
  if (instance === "local") {
    const Local = Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);
    return Local.testAccounts;
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
  return undefined;
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
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  let outString: string = ``;
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  const inOptions: string = `abcdefghijklmnopqrstuvwxyz0123456789`;

  for (let i = 0; i < length; i++) {
    outString += inOptions.charAt(Math.floor(Math.random() * inOptions.length));
  }

  return outString;
}

function formatTime(ms: number): string {
  if (ms === undefined) return "";
  if (ms < 1000) return ms.toString() + " ms";
  if (ms < 60 * 1000)
    return parseInt((ms / 1000).toString()).toString() + " sec";
  if (ms < 60 * 60 * 1000)
    return parseInt((ms / 1000 / 60).toString()).toString() + " min";
  return parseInt((ms / 1000 / 60 / 60).toString()).toString() + " h";
}

class Memory {
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  static rss: number = 0;
  constructor() {
    Memory.rss = 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  public static info(description: string = ``, fullInfo: boolean = false) {
    const memoryData = process.memoryUsage();
    const formatMemoryUsage = (data: number) =>
      `${Math.round(data / 1024 / 1024)} MB`;
    const oldRSS = Memory.rss;
    Memory.rss = Math.round(memoryData.rss / 1024 / 1024);

    const memoryUsage = fullInfo
      ? {
          step: `${description}:`,
          rssDelta: `${(oldRSS === 0
            ? 0
            : Memory.rss - oldRSS
          ).toString()} MB -> Resident Set Size memory change`,
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
        }
      : `RSS memory ${description}: ${formatMemoryUsage(memoryData.rss)}${
          oldRSS === 0
            ? ``
            : `, changed by ` + (Memory.rss - oldRSS).toString() + ` MB`
        }`;

    console.log(memoryUsage);
  }
}
