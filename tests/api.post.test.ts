/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, expect, it } from "@jest/globals";
import { MinaNFT } from "../src/minanft";
import { MinaNFTNameService } from "../src/minanftnames";
import { PublicKey, PrivateKey, Poseidon, Signature } from "o1js";
import { api } from "../src/api/api";
import { blockchain, initBlockchain, makeString } from "../utils/testhelpers";
import { Memory } from "../src/mina";
import { PINATA_JWT, JWT } from "../env.json";
import { MINANFT_NAME_SERVICE } from "../src/config";
import { MapData } from "../src/storage/map";

const pinataJWT = PINATA_JWT;
const blockchainInstance: blockchain = "testworld2";
const includeFiles = true;

let deployer: PrivateKey | undefined = undefined;
let nftPrivateKey: PrivateKey | undefined = undefined;
//let nameService: MinaNFTNameService | undefined = undefined;
//let oraclePrivateKey: PrivateKey | undefined = undefined;
let uri: string | undefined = undefined;

beforeAll(async () => {
  const data = await initBlockchain(blockchainInstance, 0);
  expect(data).toBeDefined();
  if (data === undefined) return;

  const { deployer: d } = data;
  deployer = d;
  expect(deployer).toBeDefined();
  if (deployer === undefined) return;
});

describe(`MinaNFT mint using api`, () => {
  let nft: MinaNFT | undefined = undefined;
  /*
  it(`should compile contracts`, async () => {
    MinaNFT.setCacheFolder("./nftcache");
    console.log(`Compiling...`);
    console.time(`compiled all`);
    await MinaNFT.compile();
    console.timeEnd(`compiled all`);
    Memory.info(`compiled`);
  });
*/
  /*
  it(`should deploy NameService`, async () => {
    expect(deployer).toBeDefined();
    if (deployer === undefined) return;
    oraclePrivateKey = PrivateKey.random();
    const names = new MinaNFTNameService({
      oraclePrivateKey,
    });
    const tx = await names.deploy(deployer);
    expect(tx).toBeDefined();
    if (tx === undefined) return;
    Memory.info(`names service deployed`);
    expect(await MinaNFT.wait(tx)).toBe(true);
    nameService = names;
  });
*/
  it(`should create NFT`, async () => {
    const ownerPrivateKey = PrivateKey.random();
    const ownerPublicKey = ownerPrivateKey.toPublicKey();
    const owner = Poseidon.hash(ownerPublicKey.toFields());
    nftPrivateKey = PrivateKey.random();
    const nftPublicKey = nftPrivateKey.toPublicKey();

    nft = new MinaNFT({
      name: `@test_${makeString(20)}`,
      owner,
      address: nftPublicKey,
    });
    nft.updateText({
      key: `description`,
      text: "This is my long description of the NFT. Can be of any length, supports **markdown**.",
    });
    nft.update({ key: `twitter`, value: `@builder` });
    nft.update({ key: `secret`, value: `mysecretvalue`, isPrivate: true });
    if (includeFiles)
      await nft.updateImage({
        filename: "./images/image.jpg",
        pinataJWT,
      });

    uri = nft.exportToString({
      increaseVersion: true,
      includePrivateData: false,
    });
    Memory.info(`created`);
  });

  /*
  it(`should mint NFT using nft imported from JSON`, async () => {
    expect(deployer).toBeDefined();
    if (deployer === undefined) return;
    expect(uri).toBeDefined();
    if (uri === undefined) return;
    expect(nft).toBeDefined();
    if (nft === undefined) return;

    const oraclePrivateKey = PrivateKey.fromBase58(NAMES_ORACLE_SK);
    const nameServiceAddress = PublicKey.fromBase58(MINANFT_NAME_SERVICE);
    const nameService = new MinaNFTNameService({
      oraclePrivateKey,
      address: nameServiceAddress,
    });

    const privateKey = "";
    const zkAppPrivateKey =
      privateKey === ""
        ? PrivateKey.random()
        : PrivateKey.fromBase58(privateKey);

    const nft7 = MinaNFT.fromJSON({
      metadataURI: uri,
      nameServiceAddress,
      skipCalculatingMetadataRoot: true,
    });

    console.time("mint");
    const tx = await nft7.mint(
      {
        nameService,
        deployer,
        pinataJWT,
        privateKey: zkAppPrivateKey,
      },
      true
    );
    console.timeEnd("mint");
    expect(tx).toBeDefined();
    if (tx === undefined) return;
    Memory.info(`minted`);
    expect(await MinaNFT.wait(tx)).toBe(true);
    expect(await nft7.checkState()).toBe(true);
  });
  */
  it(`should mint NFT using api call`, async () => {
    expect(nft).toBeDefined();
    if (nft === undefined) return;
    expect(nftPrivateKey).toBeDefined();
    if (nftPrivateKey === undefined) return;
    const minanft = new api(JWT);
    const uri = nft.exportToString({
      increaseVersion: true,
      includePrivateData: false,
    });
    //console.log("uri", uri);

    const reserved = await minanft.reserveName({
      name: nft.name,
      publicKey: nft.address.toBase58(),
    });
    console.log("Reserved:", reserved);
    if (
      !reserved.success ||
      !reserved.isReserved ||
      reserved.signature === undefined
    ) {
      throw new Error("Name not reserved");
    }

    console.log("Minting...");
    const result = await minanft.mint({ uri,
      signature: reserved.signature,
      privateKey: nftPrivateKey.toBase58(), });
    console.log("mint result", result);
    expect(result.success).toBe(true);
  });
});
