import { describe, expect, it } from "@jest/globals";
import { fetchAccount, PrivateKey, Mina, PublicKey, UInt64, AccountUpdate,  } from "o1js";
import { DEPLOYER, DEPLOYERS } from "../env.json";
import { MinaNFT } from "../src/minanft";


describe("deployers", () => {
  it("should get deployers balance", async () => {

  let deployer: PrivateKey | undefined = undefined;
  MinaNFT.minaInit('berkeley')
  deployer = PrivateKey.fromBase58(DEPLOYER);

  const balanceDeployer =
  Number((await accountBalance(deployer.toPublicKey())).toBigInt()) / 1e9;
console.log(
  `Balance of the Deployer is`,
  balanceDeployer.toLocaleString(`en`),
  deployer.toPublicKey().toBase58()
);

  for (let i = 0; i < DEPLOYERS.length; i++) {
    const privateKey = PrivateKey.fromBase58(DEPLOYERS[i]);
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
