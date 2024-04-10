/* eslint-disable @typescript-eslint/no-inferrable-types */
export {
  accountBalance,
  accountBalanceMina,
  sleep,
  makeString,
  initBlockchain,
  blockchain,
};

import { fetchAccount, PrivateKey, Mina, PublicKey, UInt64 } from "o1js";
import {
  initBlockchain as initBlockchainMina,
  accountBalance,
  accountBalanceMina,
} from "../src/mina";
import { blockchain } from "../src/networks";
import { Memory } from "../src/mina";

import { DEPLOYER, DEPLOYERS } from "../env.json";

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
  } else if (instance === "berkeley") {
    initBlockchainMina("berkeley");
    deployer = PrivateKey.fromBase58(DEPLOYER);
    for (let i = 0; i < deployersNumber; i++) {
      const privateKey = PrivateKey.fromBase58(DEPLOYERS[i]);
      deployers.push(privateKey);
    }
  } else if (instance === "devnet") {
    initBlockchainMina("devnet");
    deployer = PrivateKey.fromBase58(DEPLOYER);
    for (let i = 0; i < deployersNumber; i++) {
      const privateKey = PrivateKey.fromBase58(DEPLOYERS[i]);
      deployers.push(privateKey);
    }
  } else if (instance === "zeko") {
    initBlockchainMina("zeko");
    deployer = PrivateKey.fromBase58(DEPLOYER);
    for (let i = 0; i < deployersNumber; i++) {
      const privateKey = PrivateKey.fromBase58(DEPLOYERS[i]);
      deployers.push(privateKey);
    }
  } else if (instance === "testworld2") {
    initBlockchainMina("testworld2");
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
