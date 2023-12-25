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

    const balance = await arweave.wallets.getBalance(address);
    console.log("Balance:", balance);
    const ar = arweave.ar.winstonToAr(balance);
    console.log("Ar balance:", ar);
    console.log("Ar balance change: USD", 1 - parseFloat(ar));
    const transactionId = await arweave.wallets.getLastTransactionID(address);
    console.log("transactionId", transactionId);
    const transaction = await arweave.createTransaction(
      {
        data: Buffer.from("Some data 123", "utf8"),
      },
      key
    );
    transaction.addTag("Content-Type", "text/html");
    transaction.addTag("key2", "value2");
    await arweave.transactions.sign(transaction, key);
    //console.log("transaction", transaction);
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
    */
    const txId = "CtQFMSLwvvWDkl5b2epJAroxXVbr1ISlAl1quCaxrOc";
    const status = await arweave.transactions.getStatus(txId);
    console.log("status", status);

    const tx = await arweave.transactions.get(txId);
    console.log("tx", tx);
    /*
     https://arweave.net/[transaction_id]
     https://arweave.net/bNbA3TEQVL60xlgCcqdz4ZPHFZ711cZ3hmkpGttDt_U
     https://scar.arweave.dev/#/tx/CtQFMSLwvvWDkl5b2epJAroxXVbr1ISlAl1quCaxrOc

      status {
  status: 200,
  confirmed: {
    block_height: 1329591,
    block_indep_hash: 'TLVzut5TI_Z_HLfJDh_vuRfClBVGVI2N5wdU9vqf_yF6EfDRz4iWRR5GK9BPlIG2',
    number_of_confirmations: 2
  }
}

    */
  });
});
