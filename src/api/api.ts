import axios from "axios";
import { sleep } from "../mina";

import config from "../config";
const { MINNFTAPIAUTH, MINNFTAPI } = config;

export class api {
  jwt: string;
  endpoint: string;

  constructor(jwt: string) {
    this.jwt = jwt;
    this.endpoint = MINNFTAPI;
  }

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

  public async indexName(data: { name: string }): Promise<{
    success: boolean;
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
    const indexed =
      result.data === undefined ? { success: false } : result.data;
    return {
      success: result.success,
      error: result.error,
      reason: indexed.reason,
    };
  }

  /*
   * Mints a new NFT using serverless api call
   * @param uri the uri of the metadata
   * @param privateKey the private key of the address where NFT should be minted
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
      name: "mint",
      task: "mint",
      args: [
        data.signature,
        data.privateKey,
        (data.useArweave ?? false).toString(),
      ],
    });
    return { success: result.success, jobId: result.data, error: result.error };
  }

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

/*

  public async mint(data: { uri: string; privateKey?: string }): Promise<{
    success: boolean;
    error?: string;
    jobId?: string;
  }> {
    console.log("mint");
    const result = await this.apiHub("mint_v2", data);
    return { success: result.success, error: result.error, jobId: result.data };
  }
  
  public async sum(data: { transactions: string[] }): Promise<{
    success: boolean;
    error?: string;
    jobId?: string;
  }> {
    console.log("sum");
    const result = await this.apiHub("sum", data);
    return { success: result.success, error: result.error, jobId: result.data };
  }

  public async sum_v2(data: {
    transactions: string[];
    task: string;
    arguments: string[];
  }): Promise<{
    success: boolean;
    error?: string;
    jobId?: string;
  }> {
    console.log("sum_v2");
    const result = await this.apiHub("sum_v2", data);
    return { success: result.success, error: result.error, jobId: result.data };
  }

  public async sum_v2_result(data: { jobId: string }): Promise<{
    success: boolean;
    error?: string;
    result?: any;
  }> {
    //console.log("sum_v2_result", data);
    const result = await this.apiHub("sum_v2_result", data);
    return {
      success: result.success,
      error: result.error,
      result: result.data,
    };
  }

  public async tree(data: {
    transactions: string[];
    task: string;
    arguments: string[];
  }): Promise<{
    success: boolean;
    error?: string;
    jobId?: string;
  }> {
    //console.log("tree", data);
    const result = await this.apiHub("tree", data);
    return { success: result.success, error: result.error, jobId: result.data };
  }

  public async tree_result(data: { jobId: string }): Promise<{
    success: boolean;
    error?: string;
    result?: any;
  }> {
    //console.log("sum_v2_result", data);
    const result = await this.apiHub("sum_v2_result", data);
    return {
      success: result.success,
      error: result.error,
      result: result.data,
    };
  }

  public async computeRecursiveProof(data: {
    contractName: string;
    transactions: string[];
  }): Promise<{
    success: boolean;
    error?: string;
    jobId?: string;
  }> {
    const result = await this.apiHub("computeRecursiveProof", data);
    return { success: result.success, error: result.error, jobId: result.data };
  }

  public async retreiveProof(jobId: string): Promise<{
    success: boolean;
    error?: string;
    proof?: string;
  }> {
    return { success: false };
  }
*/
