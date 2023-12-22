import { describe, expect, it } from "@jest/globals";
import Arweave from "arweave";
import { Encoding } from "o1js";
import { MinaNFT } from "../src/minanft";
import { ARWEAVE_KEY, ARWEAVE_ADDRESS, ARWEAVE_KEY_STRING } from "../env.json";

let arweave: Arweave;

beforeAll(() => {
  arweave = Arweave.init({
    host: "arweave.net",
    port: 443,
    protocol: "https",
  });
});

describe("Arewave", () => {
  it("should create arweave account and transaction", async () => {
    //const key = await arweave.wallets.generate();
    const key = ARWEAVE_KEY;
    const keyString = JSON.stringify(key);
    //console.log("Key:", keyString);
    const address = await arweave.wallets.jwkToAddress(key);
    console.log("Address:", address);
    expect(address).toBe(ARWEAVE_ADDRESS);

    //console.log("Key2:", ARWEAVE_KEY_STRING);
    const key2 = JSON.parse(ARWEAVE_KEY_STRING);
    const address2 = await arweave.wallets.getAddress(key2);
    expect(address2).toBe(ARWEAVE_ADDRESS);

    const balance = await arweave.wallets.getBalance(
      "1seRanklLU_1VTGkEk7P0xAwMJfA7owA1JHW5KyZKlY"
    );
    console.log("Balance:", balance);
    const ar = arweave.ar.winstonToAr(balance);
    console.log("Ar:", ar);
    const balance1 = await arweave.wallets.getBalance(address);
    console.log("Balance1:", balance1);
    const ar1 = arweave.ar.winstonToAr(balance1);
    console.log("Ar1:", ar1);
    const transactionId = await arweave.wallets.getLastTransactionID(
      "1seRanklLU_1VTGkEk7P0xAwMJfA7owA1JHW5KyZKlY"
    );
    console.log("transactionId", transactionId);
    const transaction = await arweave.createTransaction(
      {
        data: Buffer.from("Some data", "utf8"),
      },
      key
    );
    transaction.addTag("Content-Type", "text/html");
    transaction.addTag("key2", "value2");
    await arweave.transactions.sign(transaction, key);
    console.log("transaction", transaction);
    const hash = transaction.id;
    const storage = `a:${hash}`;
    console.log("storage", storage);
    const storageFields = Encoding.stringToFields(storage);
    expect(storageFields.length).toBe(2);

    /*
        let data = fs.readFileSync('path/to/file.pdf');

        let transaction = await arweave.createTransaction({ data: data }, key);
        transaction.addTag('Content-Type', 'application/pdf');

        await arweave.transactions.sign(transaction, key);

        let uploader = await arweave.transactions.getUploader(transaction);

        while (!uploader.isComplete) {
          await uploader.uploadChunk();
          console.log(`${uploader.pctComplete}% complete, ${uploader.uploadedChunks}/${uploader.totalChunks}`);
        }
    */

    /*
    const uploader = await arweave.transactions.getUploader(transaction);

    while (!uploader.isComplete) {
      await uploader.uploadChunk();
      console.log(
        `${uploader.pctComplete}% complete, ${uploader.uploadedChunks}/${uploader.totalChunks}`
      );
    }

    const status = await arweave.transactions.getStatus(transaction.id);
    console.log("status", status);

    const tx = await arweave.transactions.get(
      "hKMMPNh_emBf8v_at1tFzNYACisyMQNcKzeeE1QE9p8"
    );
    console.log("tx", tx);

     https://arweave.net/[transaction_id]
     https://arweave.net/bNbA3TEQVL60xlgCcqdz4ZPHFZ711cZ3hmkpGttDt_U
    */
  });
});
