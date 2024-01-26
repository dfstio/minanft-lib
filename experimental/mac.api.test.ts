import { describe, expect, it } from "@jest/globals";
import {
  Mina,
  JsonProof,
  verify,
  VerificationKey,
} from "o1js";
import { formatTime } from "../src/mina";
import { MinaNFT } from "../src/minanft";

import {  blockchain, initBlockchain } from "../utils/testhelpers";
import { Memory } from "../src/mina";
import { JWT } from "../env.json";
import { api } from "../src/api/api";

const blockchainInstance: blockchain = 'local';

const transactions: string[] = ["1"];
let tx: Mina.TransactionId | undefined = undefined;
// eslint-disable-next-line @typescript-eslint/no-inferrable-types
let jobId: string = "";
// eslint-disable-next-line @typescript-eslint/no-inferrable-types
let proof: string = "";

beforeAll(async () => {
  const data = await initBlockchain(blockchainInstance, 0);
  expect(data).toBeDefined();
  if (data === undefined) return;

});

describe(`MinaNFT Redacted Merkle Tree calculations`, () => {
 

  it(`should compile using api call`, async () => {
    const minanft = new api(JWT);
    console.log("transactions", transactions.length);

    const apiresult = await minanft.proof({
      transactions,
      developer: "@marek",
      name: "compile",
      task: "proof",
      args: ["1"],
    });

    console.log("api result", apiresult);
    expect(apiresult.success).toBe(true);
    expect(apiresult.jobId).toBeDefined();
    if (apiresult.jobId === undefined) return;
    jobId = apiresult.jobId;
  });

 

  it(`should get result using api call`, async () => {
    expect(jobId).toBeDefined();
    if (jobId === undefined) return;
    expect(jobId).not.toBe("");
    if (jobId === "") return;
    const minanft = new api(JWT);
    const result = await minanft.waitForJobResult({ jobId });
    /*
    let ready: boolean = false;
    while (!ready) {
      await sleep(5000);
      const result = await minanft.proofResult({ jobId });
   */
    if (result.success) {
      if (result.result.result !== undefined) {
        //ready = true;
        //console.log("status", result.status);
        //console.log("Final result", result.result.result);
        proof = result.result.result;
        console.log(
          "Billed duration",
          formatTime(result.result.billedDuration),
          result.result.billedDuration
        );
        console.log(
          "Duration",
          formatTime(result.result.timeFinished - result.result.timeCreated),
          result.result.timeFinished - result.result.timeCreated
        );
      }
    } else {
      console.log("ERROR", result);
    }
    if (result.result.jobStatus === "failed") {
      //ready = true;
      console.log("status:", result.result.jobStatus);
      console.log("Final result", result.result.result);
      console.log(
        "Billed duration",
        formatTime(result.result.billedDuration),
        result.result.billedDuration
      );
      console.log(
        "Duration",
        formatTime(result.result.timeFailed - result.result.timeCreated),
        result.result.timeFailed - result.result.timeCreated
      );
      // }
    }
  });

 
});
