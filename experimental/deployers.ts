import { Mina, PrivateKey, PublicKey, Field, fetchAccount } from "o1js";
import { MINAURL, MINAEXPLORER } from "../src/config.json";

function generateAccount() {
  const zkAppPrivateKey = PrivateKey.random();
  const zkAppPrivateKeyString = PrivateKey.toBase58(zkAppPrivateKey);
  const zkAppAddress = zkAppPrivateKey.toPublicKey();
  const zkAppAddressString = PublicKey.toBase58(zkAppAddress);
  const salt = Field.random();

  return {
    privateKey: zkAppPrivateKeyString,
    publicKey: zkAppAddressString,
    explorer: `${MINAEXPLORER}${zkAppAddressString}`,
    salt: salt.toJSON(),
  };
}

async function topupAccount(publicKey: string) {
  await Mina.faucet(PublicKey.fromBase58(publicKey));
}

async function accountBalance(publicKey: string) {
  const address = PublicKey.fromBase58(publicKey);
  let check = Mina.hasAccount(address);
  //console.log("check1", check);
  if (!check) {
    await fetchAccount({ publicKey: address });
    check = Mina.hasAccount(address);
    //console.log("check2", check);
    if (!check) return 0;
  }
  const balance = Mina.getBalance(address);
  return balance.toBigInt();
}

async function minaInit() {
  const Network = Mina.Network(MINAURL);
  Mina.setActiveInstance(Network);
  console.log("o1js loaded");
}

async function main() {
  await minaInit();
  let i: number;
  for (i = 0; i < 100; i++) {
    try {
      const acc = generateAccount();
      await topupAccount(acc.publicKey);
      const delay: number = 1000 + Math.floor(Math.random() * 1000);
      await sleep(delay);
      const balance = await accountBalance(acc.publicKey);
      if (balance !== 0) console.log(`"${acc.privateKey}",`);
    } catch (error: any) {
      console.log(error);
      await sleep(1000 * 60 * 10);
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
