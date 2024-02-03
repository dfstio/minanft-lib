import { describe, expect, it } from "@jest/globals";
import { fetchAccount, PrivateKey, Mina, PublicKey, UInt64 } from "o1js";
import { MinaNFT } from "../src/minanft";


describe("deployers", () => {
  it("should topup deployers", async () => {

  MinaNFT.minaInit('berkeley');
  for (let i = 0; i < 1000; i++) {
    const privateKey = PrivateKey.random();

      try {
          await Mina.faucet(privateKey.toPublicKey());
          await sleep(1000 * (600 + Math.floor(Math.random() * 600)));
      } catch (e) {
        console.log(e);
        await sleep(1000 * 60 * 60);
        await Mina.faucet(privateKey.toPublicKey());
      }
      
      const balanceDeployer =
        Number((await accountBalance(privateKey.toPublicKey())).toBigInt()) /
        1e9;
      if( balanceDeployer > 0 ) 
        console.log(`[${privateKey.toBase58()}],`);
      else
      console.log(
        `Balance of the Deployer`,
        i,
        privateKey.toPublicKey().toBase58(),
        privateKey.toBase58(),
        `is`,
        balanceDeployer.toLocaleString(`en`)
      );
    
  }
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
