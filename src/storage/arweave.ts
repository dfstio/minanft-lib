export { ARWEAVE };
import Arweave from "arweave";
import { sleep } from "../mina";

class ARWEAVE {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private key: any;
  arweave: Arweave;

  constructor(key: string | object) {
    if (typeof key === "string") {
      if (key === "") key = { test: true };
      else this.key = JSON.parse(key);
    } else {
      this.key = key;
    }
    this.arweave = Arweave.init({
      host: "arweave.net",
      port: 443,
      protocol: "https",
    });
  }

  public async pinString(
    data: string,
    // eslint-disable-next-line @typescript-eslint/no-inferrable-types
    waitForConfirmation: boolean = false
  ): Promise<string | undefined> {
    try {
      if (this.key === undefined) return undefined;
      if (this.key?.test === true)
        return "CtQFMSLwvvWDkl5b2epJAroxXVbr1ISlAl1quCaxrOc";
      const address = await this.arweave.wallets.jwkToAddress(this.key);
      const balance = await this.arweave.wallets.getBalance(address);
      if (parseInt(balance) === 0) return undefined;

      const transaction = await this.arweave.createTransaction(
        {
          data: Buffer.from(data, "utf8"),
        },
        this.key
      );
      transaction.addTag("Content-Type", "application/json");
      await this.arweave.transactions.sign(transaction, this.key);

      const uploader = await this.arweave.transactions.getUploader(transaction);

      while (!uploader.isComplete) {
        await uploader.uploadChunk();
        console.log(
          `${uploader.pctComplete}% complete, ${uploader.uploadedChunks}/${uploader.totalChunks}`
        );
      }
      //console.log("transaction", transaction);
      const hash = transaction.id;
      console.log("arweave hash", hash);
      if (waitForConfirmation) await this.wait({ hash }); // wait for confirmation, can take a while

      return hash;
    } catch (err) {
      console.error(err);
      return undefined;
    }
  }

  public async pinFile(
    data: Buffer,
    filename: string,
    size: number,
    mimeType: string,
    // eslint-disable-next-line @typescript-eslint/no-inferrable-types
    waitForConfirmation: boolean = false
  ): Promise<string | undefined> {
    try {
      if (this.key === undefined) return undefined;
      if (this.key?.test === true)
        return "CtQFMSLwvvWDkl5b2epJAroxXVbr1ISlAl1quCaxrOc";
      const address = await this.arweave.wallets.jwkToAddress(this.key);
      const balance = await this.arweave.wallets.getBalance(address);
      if (parseInt(balance) === 0) return undefined;

      const transaction = await this.arweave.createTransaction(
        { data: data },
        this.key
      );
      transaction.addTag("Content-Type", mimeType);
      transaction.addTag("knownLength", size.toString());
      transaction.addTag("filename", filename);
      await this.arweave.transactions.sign(transaction, this.key);
      const uploader = await this.arweave.transactions.getUploader(transaction);

      while (!uploader.isComplete) {
        await uploader.uploadChunk();
        console.log(
          `${uploader.pctComplete}% complete, ${uploader.uploadedChunks}/${uploader.totalChunks}`
        );
      }
      //console.log("transaction", transaction);
      const hash = transaction.id;
      console.log("arweave hash", hash);
      if (waitForConfirmation) await this.wait({ hash }); // wait for confirmation, can take a while
      return hash;
    } catch (err) {
      console.error(err);
      return undefined;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async status(hash: string) {
    try {
      const status = await this.arweave.transactions.getStatus(hash);
      return { success: true, data: status };
    } catch (err) {
      console.error(err);
      return { success: false, error: err };
    }
  }

  public async wait(data: {
    hash: string;
    maxAttempts?: number;
    interval?: number;
    maxErrors?: number;
  }): Promise<{
    success: boolean;
    error?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result?: any;
  }> {
    const maxAttempts = data?.maxAttempts ?? 360;
    const interval = data?.interval ?? 5000;
    const maxErrors = data?.maxErrors ?? 10;
    const errorDelay = 30000; // 30 seconds
    let attempts = 0;
    let errors = 0;
    while (attempts < maxAttempts) {
      const result = await this.status(data.hash);
      if (result.success === false) {
        errors++;
        if (errors > maxErrors) {
          return {
            success: false,
            error: "Too many network errors",
            result: undefined,
          };
        }
        await sleep(errorDelay * errors);
      } else {
        if (result.data?.confirmed?.block_height !== undefined) {
          return {
            success: result.success,
            result: result.data,
          };
        }
        await sleep(interval);
      }
      attempts++;
    }
    return {
      success: false,
      error: "Timeout",
      result: undefined,
    };
  }

  public async balance(): Promise<string | undefined> {
    const address = await this.arweave.wallets.jwkToAddress(this.key);
    const balance = await this.arweave.wallets.getBalance(address);
    const ar = this.arweave.ar.winstonToAr(balance);
    return ar;
  }
}
