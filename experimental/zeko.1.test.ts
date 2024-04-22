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

const keys: string[] = [];
const gastanks_number = 10;

describe("deployers", () => {
  it(
    "should get deployers balance",
    async () => {
      console.log("Number of deployers:", DEPLOYERS_API.length);
      let deployer: PrivateKey | undefined = undefined;
      MinaNFT.minaInit("zeko"); //
      deployer = PrivateKey.fromBase58(DEPLOYER);
      const contractDeployer = PrivateKey.fromBase58(CONTRACT_DEPLOYER_SK);

      console.log(
        `Balance of the Deployer ${deployer.toPublicKey().toBase58()} is`,
        await accountBalanceMina(deployer.toPublicKey())
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

      console.log(
        "Wallet balance",
        await accountBalanceMina(
          PublicKey.fromBase58(
            "B62qq7ecvBQZQK68dwstL27888NEKZJwNXNFjTyu3xpQcfX5UBivCU6"
          )
        )
      );
      const length =
        DEPLOYERS_API.length > gastanks_number
          ? gastanks_number
          : DEPLOYERS_API.length;
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
  try {
    await fetchAccount({ publicKey: address });
    if (Mina.hasAccount(address)) return Mina.getBalance(address);
    else return UInt64.from(0);
  } catch (error: any) {
    //console.error(error);
    return UInt64.from(0);
  }
}

async function accountBalanceMina(address: PublicKey): Promise<number> {
  return Number((await accountBalance(address)).toBigInt()) / 1e9;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
