export { IPFS };
import axios from "axios";
import FormData from "form-data";

class IPFS {
  private auth: string;

  constructor(token: string) {
    this.auth = "Bearer " + token;
  }

  public async pinString(data: string): Promise<string | undefined> {
    try {
      // replacer will remove all private metadata from the object
      //const data = JSON.stringify(params, replacer, 2);

      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: this.auth,
        },
      };

      if (this.auth === "Bearer ")
        //for running tests
        return `QmTosaezLecDB7bAoUoXcrJzeBavHNZyPbPff1QHWw8xus`;

      const res = await axios.post(
        "https://api.pinata.cloud/pinning/pinJSONToIPFS",
        data,
        config
      );

      console.log("pinJSON result:", res.data);
      return res.data.IpfsHash;
    } catch (err) {
      console.error(err);
      return undefined;
    }
  }

  public async pinFile(
    stream: NodeJS.ReadableStream,
    filename: string,
    size: number,
    mimeType: string
  ): Promise<string | undefined> {
    try {
      const formData = new FormData();

      // append stream with a file
      formData.append("file", stream, {
        contentType: mimeType,
        knownLength: size,
        filename,
      });

      if (this.auth === "Bearer ")
        //for running tests
        return `QmaRZUgm2GYCCjsDCa5eJk4rjRogTgY6dCyXRQmnhvFmjj`;

      const response = await axios.post(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        formData,
        {
          headers: {
            Authorization: this.auth,
            ...formData.getHeaders(),
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
    return undefined;
  }

  /*
  public async pinLink(file: string): Promise<string | undefined> {
    try {
      console.log("pinLink", file);
      const auth: string = this.auth;
      const client = new S3Client({});

      const params = {
        Bucket: process.env.BUCKET!,
        Key: file,
      };

      let finished = false;
      await sleep(500);
      while (!finished) {
        console.log("Waiting for S3", file);
        const headcommand = new HeadObjectCommand(params);
        try {
          const headresponse = await client.send(headcommand);
          finished = true;
          console.log("S3 is ready:", file, headresponse);
        }
        catch (e) {
          console.log("S3 is not ready yet", file);
          await sleep(500);
        }
      }

      // Get file metadata to retrieve size and type
      const getcommand = new GetObjectCommand(params);
      const getresponse = await client.send(getcommand);

      // Get read object stream
      const s3Stream = getresponse.Body

      const formData = new FormData();

      // append stream with a file
      formData.append("file", s3Stream, {
        contentType: getresponse.ContentType,
        knownLength: getresponse.ContentLength,
        filename: file,
      });

      const response = await axios.post(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        formData,
        {
          headers: {
            Authorization: auth,
            ...formData.getHeaders(),
          },
          maxBodyLength: 25 * 1024 * 1024,
        },
      );

      console.log("addLink result:", response.data);
      if (response && response.data && response.data.IpfsHash) {
        return response.data.IpfsHash;
      } else {
        console.error("addLink error", response.data.error);
        return undefined;
      }

    } catch (err) {
      console.error("addLink error 2 - catch", err);
      return undefined;
    }
    return undefined;
  }
  */
}
