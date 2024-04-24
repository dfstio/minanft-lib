export { IPFS };
import axios from "axios";
import FormData from "form-data";
import { makeString } from "../mina";
import { NAMES_ORACLE } from "..";

class IPFS {
  private auth: string;
  static ipfsData: { [key: string]: string } = {};
  static useLocalIpfsData: boolean = false as boolean;

  constructor(token: string) {
    this.auth = token;
  }

  public async pinJSON(params: {
    data: any;
    name: string;
    keyvalues?: object;
  }): Promise<string | undefined> {
    const { data, name, keyvalues } = params;
    console.log("saveToIPFS:", { name });
    if (this.auth === "local") {
      const hash = makeString(
        `bafkreibwikqybinoumbe6v2mpzwgluhqw7n4h6d5y7eq2nogils6ibflbi`.length
      );
      IPFS.ipfsData[hash] = data;
      IPFS.useLocalIpfsData = true;
      return hash;
    }

    try {
      const pinataData = {
        pinataOptions: {
          cidVersion: 1,
        },
        pinataMetadata: {
          name,
          keyvalues,
        },
        pinataContent: data,
      };
      const str = JSON.stringify(pinataData);

      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + this.auth,
        },
      };

      if (this.auth === "")
        //for running tests
        return `bafkreibwikqybinoumbe6v2mpzwgluhqw7n4h6d5y7eq2nogils6ibflbi`;

      const res = await axios.post(
        "https://api.pinata.cloud/pinning/pinJSONToIPFS",
        str,
        config
      );

      console.log("saveToIPFS result:", res.data);
      return res.data.IpfsHash;
    } catch (error: any) {
      console.error("saveToIPFS error:", error?.message);
      return undefined;
    }
  }

  public async pinFile(params: {
    stream: NodeJS.ReadableStream;
    name: string;
    size: number;
    mimeType: string;
    keyvalues?: object;
  }): Promise<string | undefined> {
    const { stream, name, size, mimeType, keyvalues } = params;
    console.log("pinFile:", { name, size, mimeType, keyvalues });
    try {
      const form = new FormData();
      form.append("file", stream, {
        contentType: mimeType,
        knownLength: size,
        filename: name,
      });
      form.append("pinataMetadata", JSON.stringify({ name, keyvalues }));
      form.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

      if (this.auth === "")
        //for running tests
        return `bafkreibwikqybinoumbe6v2mpzwgluhqw7n4h6d5y7eq2nogils6ibflbi`;
      // TODO: add retry logic
      const response = await axios.post(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        form,
        {
          headers: {
            Authorization: "Bearer " + this.auth,
            "Content-Type": "multipart/form-data",
          },
          maxBodyLength: 25 * 1024 * 1024,
        }
      );

      console.log("pinFile result:", response.data);
      if (response && response.data && response.data.IpfsHash) {
        return response.data.IpfsHash;
      } else {
        console.error("pinFile error", response.data.error);
        return undefined;
      }
    } catch (err) {
      console.error("pinFile error 2 - catch", err);
      return undefined;
    }
  }
}
