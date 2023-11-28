import { describe, expect, it } from "@jest/globals";
import { PrivateKey, Poseidon, PublicKey, fetchAccount, Field } from "o1js";
import axios from "axios";
import { MinaNFT } from "../src/minanft";
import { Memory, blockchain, initBlockchain } from "../utils/testhelpers";
import { MinaNFTNameServiceContract } from "../src/contract/names";
import { MinaNFTContract } from "../src/contract/nft";
import { MINANFT_NAME_SERVICE } from "../src/config.json";

const blockchainInstance: blockchain = 'testworld2';
const nftAddress = 'B62qjM9zEdYBVMLcHZMFdzscmjcYtNPHMSXrfNs9VSB6gVExiZayvYb';
const ownerPrivateKey58 = 'EKEUktzsGtTPVE4xKTYRY8ZH2wmQfHrysiGmZgeuiHmUVdf4JeKg';
const ipfs = 'https://ipfs.io/ipfs/Qmf5uLwtddqMJ3GSZeiF6BLA545M3RLWCzkCEN8nPM77gK';

beforeAll(async () => {
  const data = await initBlockchain(blockchainInstance, 0);
  expect(data).toBeDefined();
  if (data === undefined) return;
});

describe(`Read NFT`, () => {
  it(`should read NFT`, async () => {
    const nameServiceAddress = PublicKey.fromBase58(MINANFT_NAME_SERVICE);
    const nameService = new MinaNFTNameServiceContract(nameServiceAddress);
    const tokenId = nameService.token.id;

    const address = PublicKey.fromBase58(nftAddress);

    const nft = new MinaNFTContract(address, tokenId);
    await fetchAccount({ publicKey: address, tokenId });

    const name = nft.name.get();
    const storage = nft.storage.get();
    const owner = nft.owner.get();
    const escrow = nft.escrow.get();
    const metadata = nft.metadata.get();
    const version = nft.version.get();

    const nameStr = MinaNFT.stringFromField(name);
    const storageStr = MinaNFT.stringFromFields(storage.toFields());
    console.log(`name: ${nameStr}`);
    console.log(`storage: ${storageStr}`);
    console.log(`escrow: ${escrow.toJSON()}`);
    console.log(`version: ${version.toJSON()}`);
    const checkOwner = Poseidon.hash(PrivateKey.fromBase58(ownerPrivateKey58).toPublicKey().toFields());
    expect(nameStr).toEqual('@middemo');
    expect('https://ipfs.io/ipfs/' + storageStr.slice(2)).toEqual(ipfs);
    expect(storageStr.slice(0, 2)).toEqual('i:');
    expect(owner).toEqual(checkOwner);
    expect(version.toJSON()).toEqual(Field.from(1).toJSON());
    expect(escrow.toJSON()).toEqual(Field.from(0).toJSON());
    const data = await axios.get(ipfs);
    const uri = data.data;
    const image = data.data.properties.image;
    console.log(uri, image);
    expect(uri.name).toEqual('@middemo');
    expect(uri.description).toEqual('');
    expect(uri.version).toEqual('1');
    expect(uri.creator).toEqual('@MinaNFT_bot');

    const nftCheck = new MinaNFT({name: nameStr});
    await nftCheck.updateImage({
      filename: "./images/image.jpg",
      pinataJWT: "",
    });
    const json : any = nftCheck.toJSON()
    const imageCheck = json.properties.image.toJSON();
    console.log(json, imageCheck);
    expect(image.linkedObject.SHA3_512).toEqual(imageCheck.linkedObject.SHA3_512);
    console.log("data:", metadata.data.toJSON(), "kind" , metadata.kind.toJSON());

  });
});
