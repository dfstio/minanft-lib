import {
  PublicKey,
  Field,
  Mina,
  fetchAccount,
  checkZkappTransaction,
} from "o1js";
import { sleep } from "./mina";

export async function fetchMinaAccount(params: {
  publicKey: string | PublicKey;
  tokenId?: string | Field | undefined;
  force?: boolean;
}) {
  const { publicKey, tokenId, force } = params;
  const timeout = 1000 * 60 * 10; // 10 minutes
  const startTime = Date.now();
  let result = { account: undefined };
  while (Date.now() - startTime < timeout) {
    try {
      const result = await fetchAccount({
        publicKey,
        tokenId,
      });
      return result;
      /*
      if (result.account !== undefined) return result;
      if (force !== true) return result;
      console.log(
        "Cannot fetch account",
        typeof publicKey === "string" ? publicKey : publicKey.toBase58(),
        result
      );
      */
    } catch (error) {
      console.log("Error in fetchAccount:", error);
    }
    await sleep(1000 * 10);
  }
  console.log("Timeout in fetchAccount");
  return result;
}

export async function fetchMinaActions(
  publicKey: PublicKey,
  fromActionState: Field,
  endActionState?: Field
) {
  const timeout = 1000 * 60 * 600; // 10 hours
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      let actions = await Mina.fetchActions(publicKey, {
        fromActionState,
        endActionState,
      });
      if (Array.isArray(actions)) return actions;
      else console.log("Cannot fetch actions - wrong format");
    } catch (error: any) {
      console.log(
        "Error in fetchMinaActions",
        error.toString().substring(0, 300)
      );
    }
    await sleep(1000 * 60 * 2);
  }
  console.log("Timeout in fetchMinaActions");
  return undefined;
}

export async function checkMinaZkappTransaction(hash: string) {
  try {
    const result = await checkZkappTransaction(hash);
    return result;
  } catch (error) {
    console.error("Error in checkZkappTransaction:", error);
    return { success: false };
  }
}
