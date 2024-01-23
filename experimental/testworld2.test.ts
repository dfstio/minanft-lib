import { describe, expect, it } from "@jest/globals";
import { fetchAccount, PrivateKey, Mina, PublicKey, UInt64, AccountUpdate } from "o1js";
import { DEPLOYER, DEPLOYERS } from "../env.json";
import { MinaNFT } from "../src/minanft";
const TESTNET = "https://api.minascan.io/node/testworld/v1/graphql";
//"https://proxy.testworld.minaexplorer.com/graphql";

const topup : boolean = false;

describe("deployers", () => {
  it("should get deployers balance", async () => {

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

      if( topup && balanceDeployer > 61) {
        const privateKeyNew = PrivateKey.random();
        const publicKey = privateKeyNew.toPublicKey();
        const sender = privateKey.toPublicKey();
      await fetchAccount({ publicKey: sender });
      await fetchAccount({ publicKey });
      const hasAccount = Mina.hasAccount(publicKey);

      const transaction = await Mina.transaction(
        { sender, fee: "2000000000"},
        () => {
          if (!hasAccount) AccountUpdate.fundNewAccount(sender);
          const senderUpdate = AccountUpdate.create(sender);
          senderUpdate.requireSignature();
          senderUpdate.send({ to: publicKey, amount: 30_000_000_000n });
        }
      );
      await transaction.prove();
      transaction.sign([privateKey]);
      const tx = await transaction.send();
      const hash = tx.hash();
      if( hash !== undefined) 
        console.log(`"${privateKeyNew.toBase58()}",`);

      } else 
    console.log(
      `Balance of the Deployer`,
      i,
      `is`,
      balanceDeployer.toLocaleString(`en`),
      //privateKey.toPublicKey().toBase58()
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
})
});

async function accountBalance(address: PublicKey): Promise<UInt64> {
  await fetchAccount({ publicKey: address });
  if (Mina.hasAccount(address)) return Mina.getBalance(address);
  else return UInt64.from(0);
}


function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
