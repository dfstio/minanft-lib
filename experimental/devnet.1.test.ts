import { describe, expect, it } from "@jest/globals";
import {
  fetchAccount,
  PrivateKey,
  Mina,
  PublicKey,
  UInt64,
  AccountUpdate,
} from "o1js";
import {
  DEPLOYER,
  GASTANKS as DEPLOYERS_API,
  CONTRACT_DEPLOYER_SK,
} from "../env.json";
import { MinaNFT } from "../src/minanft";
import { accountBalanceMina } from "../src/mina";

const keys: string[] = [];

describe("deployers", () => {
  it(
    "should get deployers balance",
    async () => {
      console.log("Number of deployers:", DEPLOYERS_API.length);
      let deployer: PrivateKey | undefined = undefined;
      MinaNFT.minaInit("devnet");
      deployer = PrivateKey.fromBase58(DEPLOYER);
      const contractDeployer = PrivateKey.fromBase58(CONTRACT_DEPLOYER_SK);

      const balanceDeployer =
        Number((await accountBalance(deployer.toPublicKey())).toBigInt()) / 1e9;
      console.log(
        `Balance of the Deployer ${deployer.toPublicKey().toBase58()} is`,
        balanceDeployer.toLocaleString(`en`)
      );

      const balanceContractDeployer =
        Number(
          (await accountBalance(contractDeployer.toPublicKey())).toBigInt()
        ) / 1e9;
      console.log(
        `Balance of the Contract Deployer ${contractDeployer
          .toPublicKey()
          .toBase58()} is`,
        balanceContractDeployer.toLocaleString(`en`)
      );
      const length = DEPLOYERS_API.length > 150 ? 150 : DEPLOYERS_API.length;
      for (let i = 0; i < length; i++) {
        const privateKey = PrivateKey.fromBase58(DEPLOYERS_API[i]);
        const publicKey = privateKey.toPublicKey();
        const balanceDeployer = await accountBalanceMina(publicKey);

        if (balanceDeployer === 0) {
          console.log(
            `Balance of the Deployer`,
            i,
            privateKey.toBase58(),
            `is`,
            balanceDeployer.toLocaleString(`en`)
          );
          /*
          try {
            await Mina.faucet(publicKey);
          } catch (e) {
            console.log(e);
          }
          await sleep(1000 * (600 + Math.floor(Math.random() * 600)));
          const balanceDeployer = await accountBalanceMina(publicKey);
          
          console.log(
            `Balance of the Deployer`,
            publicKey.toBase58(),
            `is`,
            balanceDeployer.toLocaleString(`en`)
          );
          */
        }

        console.log(
          `Balance of the Deployer`,
          i,
          privateKey.toPublicKey().toBase58(),
          `is`,
          balanceDeployer.toLocaleString(`en`)
          //privateKey.toPublicKey().toBase58()
        );
      }
    },
    1000 * (60 * 60 * 24)
  );
});

async function accountBalance(address: PublicKey): Promise<UInt64> {
  await fetchAccount({ publicKey: address });
  if (Mina.hasAccount(address)) return Mina.getBalance(address);
  else {
    console.log(`Account ${address.toBase58()} not found`);
    return UInt64.from(0);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
