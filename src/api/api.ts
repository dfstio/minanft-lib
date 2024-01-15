import axios from "axios";
import { sleep } from "../mina";

import config from "../config";
import { MinaNFTCommitData } from "../update";
const { MINNFTAPIAUTH, MINNFTAPI } = config;

/*
* API class for interacting with the serverless api
* @property jwt The jwt token for authentication, get it at https://t.me/minanft_bot?start=auth
* @property endpoint The endpoint of the serverless api
*/
export class api {
  jwt: string;
  endpoint: string;

  /*
    * Constructor for the API class
    * @param jwt The jwt token for authentication, get it at https://t.me/minanft_bot?start=auth
    */
  constructor(jwt: string) {
    this.jwt = jwt;
    this.endpoint = MINNFTAPI;
  }

  /*
    * Gets the address (publicKey) of the NFT using serverless api call
    * @param name The name of the NFT
    */
  public async lookupName(name: string): Promise<{
    success: boolean;
    error?: string;
    address?: string;
    reason?: string;
  }> {
    const result = await this.apiHub("lookupName", {
      transactions: [],
      developer: "@dfst",
      name: "lookupName",
      task: "lookupName",
      args: [name],
    });
    return {
      success: result.success,
      error: result.error,
      address: result.data === "error" ? undefined : result.data,
      reason: result.data === "error" ? "not found" : undefined,
    };
  }

  /*
    * Reserves the name of the NFT using serverless api call
    * @param name The name of the NFT
    * @param publicKey The public key of the NFT
    */
  public async reserveName(data: { name: string; publicKey: string }): Promise<{
    success: boolean;
    error?: string;
    price: object;
    isReserved: boolean;
    signature?: string;
    reason?: string;
  }> {
    const result = await this.apiHub("reserveName", {
      transactions: [],
      developer: "@dfst",
      name: "reserveName",
      task: "reserveName",
      args: [data.name, data.publicKey],
    });
    const reserved =
      result.data === undefined ? { success: false } : result.data;
    const price: object = reserved.price ? JSON.parse(reserved.price) : {};
    return {
      success: result.success,
      error: result.error,
      price: price,
      isReserved: reserved.success ?? false,
      signature: reserved.signature,
      reason: reserved.reason ?? reserved.toString(),
    };
  }

  /*
    * Index the NFT using serverless api call
    * The NFT mint transaction should be included in the block before calling this function
    * otherwise it will fail and return isIndexed : false
    * @param name The name of the NFT
    */
  public async indexName(data: { name: string }): Promise<{
    success: boolean;
    isIndexed: boolean;
    error?: string;
    reason?: string;
  }> {
    const result = await this.apiHub("indexName", {
      transactions: [],
      developer: "@dfst",
      name: "indexName",
      task: "indexName",
      args: [data.name],
    });
    const isIndexed = result?.data?.success ?? false;
    return {
      success: result.success,
      isIndexed,
      error: result.error ?? "",
      reason: result?.data?.reason ?? "",
    };
  }

  /*
   * Mints a new NFT using serverless api call
   * @param uri the uri of the metadata
   * @param signature the signature returned by the reserveName call
   * @param privateKey the private key of the address where NFT should be minted
   * @param useArweave true if the metadata should be uploaded to the Arweave, default is IPFS
   * @returns { success: boolean, error?: string, jobId?: string }
   * where jonId is the jobId of the minting transaction
   */
  public async mint(data: {
    uri: string;
    signature: string;
    privateKey: string;
    useArweave?: boolean;
  }): Promise<{
    success: boolean;
    error?: string;
    jobId?: string;
  }> {
    const result = await this.apiHub("mint_v3", {
      transactions: [data.uri],
      developer: "@dfst",
      name: "nft",
      task: "mint",
      args: [
        data.signature,
        data.privateKey,
        (data.useArweave ?? false).toString(),
      ],
    });
    return { success: result.success, jobId: result.data, error: result.error };
  }

  /*
   * Creates a new post for existing NFT using serverless api call
   * @param commitData the commit data
   * @param ownerPublicKey the owner's public key
   * @param nftName the name of the NFT
   * @param postName the name of the post
   * @returns { success: boolean, error?: string, jobId?: string }
   * where jonId is the jobId of the minting transaction
   */
  public async post(data: {
    commitData: MinaNFTCommitData;
    ownerPublicKey: string;
    nftName: string;
    postName: string;
  }): Promise<{
    success: boolean;
    error?: string;
    jobId?: string;
  }> {
    const result = await this.apiHub("post_v3", {
      transactions: data.commitData.transactions,
      developer: "@dfst",
      name: "post",
      task: "mint",
      args: [
        data.commitData.signature,
        data.commitData.address,
        data.commitData.update,
        data.ownerPublicKey,
        data.nftName,
        data.postName,
      ],
    });
    return { success: result.success, jobId: result.data, error: result.error };
  }

  /*
    * Starts a new job for the proof calculation using serverless api call
    * The developer and name should correspond to the BackupPlugin of the API
    * All other parameters should correspond to the parameters of the BackupPlugin
    * @param transactions the transactions
    * @param developer the developer
    * @param name the name of the job
    * @param task the task of the job
    * @param args the arguments of the job
    * @returns { success: boolean, error?: string, jobId?: string }
    * where jonId is the jobId of the job
    */
  public async proof(data: {
    transactions: string[];
    developer: string;
    name: string;
    task: string;
    args: string[];
  }): Promise<{
    success: boolean;
    error?: string;
    jobId?: string;
  }> {
    const result = await this.apiHub("proof", data);
    if (result.data === "error")
      return {
        success: false,
        error: result.error,
      };
    else
      return {
        success: result.success,
        jobId: result.data,
        error: result.error,
      };
  }

  /*
    * Gets the result of the job using serverless api call
    * @param jobId the jobId of the job
    * @returns { success: boolean, error?: string, result?: any }
    * where result is the result of the job
    * if the job is not finished yet, the result will be undefined
    * if the job failed, the result will be undefined and error will be set
    * if the job is finished, the result will be set and error will be undefined
    * if the job is not found, the result will be undefined and error will be set
    */
  public async jobResult(data: { jobId: string }): Promise<{
    success: boolean;
    error?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result?: any;
  }> {
    const result = await this.apiHub("jobResult", data);
    if (this.isError(result.data))
      return {
        success: false,
        error: result.error,
        result: result.data,
      };
    else
      return {
        success: result.success,
        error: result.error,
        result: result.data,
      };
  }

  /*
    * Gets the billing report for the jobs sent using JWT
    * @returns { success: boolean, error?: string, result?: any }
    * where result is the billing report
    */
  public async queryBilling(): Promise<{
    success: boolean;
    error?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result?: any;
  }> {
    const result = await this.apiHub("queryBilling", {});
    if (this.isError(result.data))
      return {
        success: false,
        error: result.error,
        result: result.data,
      };
    else
      return {
        success: result.success,
        error: result.error,
        result: result.data,
      };
  }

  /*
    * Waits for the job to finish
    * @param jobId the jobId of the job
    * @param maxAttempts the maximum number of attempts, default is 360 (2 hours)
    * @param interval the interval between attempts, default is 20000 (20 seconds)
    * @param maxErrors the maximum number of network errors, default is 10
    * @returns { success: boolean, error?: string, result?: any }
    * where result is the result of the job
    */
  public async waitForJobResult(data: {
    jobId: string;
    maxAttempts?: number;
    interval?: number;
    maxErrors?: number;
  }): Promise<{
    success: boolean;
    error?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result?: any;
  }> {
    const maxAttempts = data?.maxAttempts ?? 360; // 2 hours
    const interval = data?.interval ?? 20000;
    const maxErrors = data?.maxErrors ?? 10;
    const errorDelay = 30000; // 30 seconds
    let attempts = 0;
    let errors = 0;
    while (attempts < maxAttempts) {
      const result = await this.apiHub("jobResult", data);
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
        if (this.isError(result.data))
          return {
            success: false,
            error: result.error,
            result: result.data,
          };
        else if (result.data?.result !== undefined) {
          return {
            success: result.success,
            error: result.error,
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

  /*
    * Calls the serverless API
    * @param command the command of the API
    * @param data the data of the API
    * */
  private async apiHub(
    command: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<{ success: boolean; data?: any; error?: any }> {
    const apiData = {
      auth: MINNFTAPIAUTH,
      command: command,
      jwtToken: this.jwt,
      data: data,
    };

    try {
      const response = await axios.post(this.endpoint, apiData);
      return { success: true, data: response.data };
    } catch (error) {
      console.error("catch api", error);
      return { success: false, error: error };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private isError(data: any): boolean {
    if (data === "error") return true;
    if (data?.jobStatus === "failed") return true;
    if (typeof data === "string" && data.toLowerCase().startsWith("error"))
      return true;
    return false;
  }
}

