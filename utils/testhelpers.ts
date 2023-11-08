export {
  accountBalance,
  sleep,
  makeString,
  Memory,
  blockchain,
  initBlockchain,
};

import { fetchAccount, PrivateKey, Mina, PublicKey, UInt64 } from "o1js";

import { MINAURL, ARCHIVEURL, TESTWORLD2 } from "../src/config.json";
import { DEPLOYER, DEPLOYERS } from "../env.json";

type blockchain = "local" | "berkeley" | "testworld2" | "mainnet";

async function initBlockchain(
  instance: blockchain,
  deployersNumber: number = 0
): Promise<{ deployer: PrivateKey; deployers: PrivateKey[] } | undefined> {
  Memory.info(`initial`);
  let deployer: PrivateKey | undefined = undefined;
  const deployers: PrivateKey[] = [];
  if (instance === "local") {
    const Local = Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);
    const { privateKey } = Local.testAccounts[0];
    deployer = privateKey;
    for (let i = 1; i <= deployersNumber; i++) {
      const { privateKey } = Local.testAccounts[i];
      deployers.push(privateKey);
    }
  } else if (instance === "berkeley" || instance === "testworld2") {
    const network = Mina.Network(
      instance === "berkeley"
        ? {
            mina: MINAURL,
            archive: ARCHIVEURL,
          }
        : {
            mina: TESTWORLD2,
          }
    );
    Mina.setActiveInstance(network);
    deployer = PrivateKey.fromBase58(DEPLOYER);
    for (let i = 0; i < deployersNumber; i++) {
      const privateKey = PrivateKey.fromBase58(DEPLOYERS[i]);
      deployers.push(privateKey);
    }
  } else {
    console.log("Mainnet is not supported yet");
    return undefined;
  }

  for (let i = 0; i < deployersNumber; i++) {
    const balanceDeployer =
      Number((await accountBalance(deployers[i].toPublicKey())).toBigInt()) /
      1e9;
    if (balanceDeployer <= 5) {
      console.log(
        `Balance of the Deployer`,
        i,
        `is`,
        balanceDeployer.toLocaleString(`en`)
      );
      return undefined;
    }
  }
  const balanceDeployer =
    Number((await accountBalance(deployer.toPublicKey())).toBigInt()) / 1e9;
  console.log(
    `Balance of the Deployer is`,
    balanceDeployer.toLocaleString(`en`)
  );
  if (balanceDeployer <= 2) return undefined;
  return { deployer, deployers };
}

async function accountBalance(address: PublicKey): Promise<UInt64> {
  await fetchAccount({ publicKey: address });
  if (Mina.hasAccount(address)) return Mina.getBalance(address);
  else return UInt64.from(0);
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
