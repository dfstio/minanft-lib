import { fetchAccount, PrivateKey, Mina, PublicKey, UInt64 } from "o1js";
import { DEPLOYER, DEPLOYERS } from "../env.json";
const TESTNET = "https://proxy.testworld.minaexplorer.com/graphql";

async function main() {
  let deployer: PrivateKey | undefined = undefined;
  const deployers: PrivateKey[] = [];
  const network = Mina.Network({
    mina: TESTNET,
  });
  Mina.setActiveInstance(network);
  deployer = PrivateKey.fromBase58(DEPLOYER);

  for (let i = 0; i < DEPLOYERS.length; i++) {
    const privateKey = PrivateKey.fromBase58(DEPLOYERS[i]);
    deployers.push(privateKey);
    const balanceDeployer =
      Number((await accountBalance(privateKey.toPublicKey())).toBigInt()) / 1e9;
    console.log(
      `Balance of the Deployer`,
      i,
      `is`,
      balanceDeployer.toLocaleString(`en`),
      privateKey.toPublicKey().toBase58()
    );
    /*
    if (balanceDeployer <= 1) {
      try {
        await Mina.faucet(privateKey.toPublicKey());
      } catch (e) {
        console.log(e);
        await sleep(1000 * 600);
        await Mina.faucet(privateKey.toPublicKey());
      }
      await sleep(1000 * (60 + Math.floor(Math.random() * 600)));
      const balanceDeployer =
        Number((await accountBalance(privateKey.toPublicKey())).toBigInt()) /
        1e9;
      console.log(
        `Balance of the Deployer`,
        i,
        `is`,
        balanceDeployer.toLocaleString(`en`)
      );
    }
    */
  }

  const balanceDeployer =
    Number((await accountBalance(deployer.toPublicKey())).toBigInt()) / 1e9;
  console.log(
    `Balance of the Deployer is`,
    balanceDeployer.toLocaleString(`en`),
    deployer.toPublicKey().toBase58()
  );
  /*
  if (balanceDeployer <= 1) {
    await sleep(1000 * (60 + Math.floor(Math.random() * 600)));
    try {
      await Mina.faucet(deployer.toPublicKey());
    } catch (e) {
      console.log(e);
      await sleep(1000 * 600);
      await Mina.faucet(deployer.toPublicKey());
    }
    await sleep(1000 * (60 + Math.floor(Math.random() * 600)));
    const balanceDeployer =
      Number((await accountBalance(deployer.toPublicKey())).toBigInt()) / 1e9;
    console.log(
      `Balance of the Deployer is`,
      balanceDeployer.toLocaleString(`en`),
      deployer.toPublicKey().toBase58()
    );
  }
  */
}

async function accountBalance(address: PublicKey): Promise<UInt64> {
  await fetchAccount({ publicKey: address });
  if (Mina.hasAccount(address)) return Mina.getBalance(address);
  else return UInt64.from(0);
}

main();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
