import { MINNFTAPIAUTH, MINNFTAPI } from "../config.json";
import axios from "axios";

export default class api {
  jwt: string;
  endpoint: string;

  constructor(jwt: string) {
    this.jwt = jwt;
    this.endpoint = MINNFTAPI;
  }

  public async reserveName(
    name: string
  ): Promise<{ success: boolean; error?: string }> {
    return { success: false };
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
    console.log("apiHub command", command);

    try {
      const response = await axios.post(this.endpoint, apiData);
      console.log("api result", response.data);
      return { success: true, data: response.data };
    } catch (error) {
      console.error("catch api", error);
      return { success: false, error: error };
    }
  }
}
