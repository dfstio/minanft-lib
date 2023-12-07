import { MINNFTAPIAUTH, MINNFTAPI } from "../config.json";
import axios from "axios";

export default class api {
  jwt: string;
  endpoint: string;

  constructor(jwt: string) {
    this.jwt = jwt;
    this.endpoint = MINNFTAPI;
  }

  public async reserveName(data: { name: string; publicKey: string }): Promise<{
    success: boolean;
    error?: string;
    price?: string;
    isReserved: boolean;
    reason?: string;
  }> {
    const result = await this.apiHub("reserveName", {
      transactions: [],
      developer: "@dfst",
      name: "reserveName",
      task: "reserveName",
      arguments: [data.name, data.publicKey],
    });
    return {
      success: result.success,
      error: result.error,
      price: result.data?.price,
      isReserved:
        result.data?.isReserved === undefined ? false : result.data.isReserved,
      reason: result.data?.reason,
    };
  }

  /*
   * Mints a new NFT using serverless api call
   * @param uri the uri of the metadata
   * @param privateKey the private key of the address where NFT should be minted
   */
  public async mint(data: { uri: string; privateKey?: string }): Promise<{
    success: boolean;
    error?: string;
    jobId?: string;
  }> {
    const result = await this.apiHub("mint_v3", {
      transactions: [data.uri],
      developer: "@dfst",
      name: "mint",
      task: "mint",
      arguments: data.privateKey ? [data.privateKey] : [],
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

  public async proofResult(data: { jobId: string }): Promise<{
    success: boolean;
    error?: string;
    result?: any;
  }> {
    const result = await this.apiHub("proofResult", data);
    if (result.data === "error")
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
