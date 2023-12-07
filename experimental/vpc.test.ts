import axios from "axios";

describe("Check internet connection", () => {
  it("should get JSON from IPFS", async () => {
    const result = await axios.get(
      "https://ipfs.io/ipfs/QmWMYpasm5FZriTQsiJdNjyJnbyMAn4mRCoboga6EVdGeu"
    );
    if (result.data !== undefined) console.log(result.data);
    else console.log("ERROR: no internet connection");
  });
});
