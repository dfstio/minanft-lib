import { describe, expect, it } from "@jest/globals";
import { fetchAccount, PrivateKey, Mina, PublicKey, UInt64, AccountUpdate,  } from "o1js";
import { DEPLOYER, DEPLOYERS } from "../env.json";
import { MinaNFT } from "../src/minanft";

const topup : boolean = false;

describe("deployers", () => {
  it("should get deployers balance", async () => {

  let deployer: PrivateKey | undefined = undefined;
  const deployers: PrivateKey[] = [];
  MinaNFT.minaInit('berkeley')
  deployer = PrivateKey.fromBase58(DEPLOYER);
  let count = 0;
  for (let i = 0; i < DEPLOYERS.length; i++) {
    const privateKey = PrivateKey.random();
    deployers.push(privateKey);
    const balanceDeployer =
      Number((await accountBalance(privateKey.toPublicKey())).toBigInt()) / 1e9;

     
    console.log(
      `Balance of the Deployer`,
      i,
      privateKey.toPublicKey().toBase58(),
      `is`,
      balanceDeployer.toLocaleString(`en`),
      //privateKey.toPublicKey().toBase58()
    );
    
    
    if (balanceDeployer <= 1) {
      console.log("Funding...")
      try {

        if( count >= 0 ) {
          await Mina.faucet(privateKey.toPublicKey());
          await sleep(1000 * (600 + Math.floor(Math.random() * 600)));
        }
        count++;
      } catch (e) {
        console.log(e);
        await sleep(1000 * 60 * 60);
        await Mina.faucet(privateKey.toPublicKey());
      }
      
      const balanceDeployer =
        Number((await accountBalance(privateKey.toPublicKey())).toBigInt()) /
        1e9;
      console.log(
        `Balance of the Deployer`,
        i,
        privateKey.toPublicKey().toBase58(),
        privateKey.toBase58(),
        `is`,
        balanceDeployer.toLocaleString(`en`)
      );
    }
    
    
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
}, 1000 * (60 * 60 * 24))
});

async function accountBalance(address: PublicKey): Promise<UInt64> {
  await fetchAccount({ publicKey: address });
  if (Mina.hasAccount(address)) return Mina.getBalance(address);
  else return UInt64.from(0);
}


function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
