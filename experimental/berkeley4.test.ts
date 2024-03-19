import { describe, expect, it } from "@jest/globals";
import {
  fetchAccount,
  PrivateKey,
  Mina,
  PublicKey,
  UInt64,
  AccountUpdate,
} from "o1js";
import { DEPLOYER, DEPLOYERS_API, CONTRACT_DEPLOYER_SK } from "../env.json";
import { MinaNFT } from "../src/minanft";

const keys: string[] = [];

describe("deployers", () => {
  it(
    "should get deployers balance",
    async () => {
      console.log("Number of deployers:", DEPLOYERS_API.length);
      let deployer: PrivateKey | undefined = undefined;
      MinaNFT.minaInit("berkeley");
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
      return;
      for (let i = 0; i < DEPLOYERS_API.length; i++) {
        if (keys.includes(DEPLOYERS_API[i])) {
          console.log(`Duplicate key ${DEPLOYERS_API[i]}`);
        } else {
          keys.push(DEPLOYERS_API[i]);
        }
        const privateKey = PrivateKey.fromBase58(DEPLOYERS_API[i]);
        const balanceDeployer =
          Number((await accountBalance(privateKey.toPublicKey())).toBigInt()) /
          1e9;

        if (balanceDeployer < 100)
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
  else return UInt64.from(0);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
