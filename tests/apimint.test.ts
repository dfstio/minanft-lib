import { describe, expect, it } from "@jest/globals";
import { MinaNFT } from "../src/minanft";
import { MinaNFTNameService } from "../src/minanftnames";
import { PublicKey, PrivateKey, Poseidon } from "o1js";
import api from "../src/api/api";
import {
  Memory,
  blockchain,
  initBlockchain,
  makeString,
} from "../utils/testhelpers";
import { PINATA_JWT, JWT } from "../env.json";
import { MINANFT_NAME_SERVICE } from "../src/config.json";
import { MapData } from "../src/storage/map";

const pinataJWT = ""; //PINATA_JWT;
const blockchainInstance: blockchain = "local";

let deployer: PrivateKey | undefined = undefined;
let nameService: MinaNFTNameService | undefined = undefined;
let oraclePrivateKey: PrivateKey | undefined = undefined;

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

  it(`should compile contracts`, async () => {
    MinaNFT.setCacheFolder("./nftcache");
    console.log(`Compiling...`);
    console.time(`compiled all`);
    await MinaNFT.compile();
    console.timeEnd(`compiled all`);
    Memory.info(`compiled`);
  });

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

  it(`should create NFT`, async () => {
    nft = new MinaNFT({ name: `@test_${makeString(20)}` });
    nft.updateText({
      key: `description`,
      text: "This is my long description of the NFT. Can be of any length, supports markdown.",
    });
    nft.update({ key: `twitter`, value: `@builder` });
    nft.update({ key: `secret`, value: `mysecretvalue`, isPrivate: true });
    await nft.updateImage({
      filename: "./images/image.jpg",
      pinataJWT,
    });
    /*
    await nft.updateFile({
      key: "sea",
      filename: "./images/sea.png",
      pinataJWT,
    });
    */
    const map = new MapData();
    map.update({ key: `level2-1`, value: `value21` });
    map.update({ key: `level2-2`, value: `value22` });
    map.updateText({
      key: `level2-3`,
      text: `This is text on level 2. Can be very long`,
    });
    /*
    await map.updateFile({
      key: "woman",
      filename: "./images/woman.png",
      pinataJWT,
    });
    */
    const mapLevel3 = new MapData();
    mapLevel3.update({ key: `level3-1`, value: `value31` });
    mapLevel3.update({ key: `level3-2`, value: `value32`, isPrivate: true });
    mapLevel3.update({ key: `level3-3`, value: `value33` });
    map.updateMap({ key: `level2-4`, map: mapLevel3 });
    nft.updateMap({ key: `level 2 and 3 data`, map });
    const data = nft.exportToString({
      increaseVersion: false,
      includePrivateData: true,
    });

    expect(nameService).toBeDefined();
    if (nameService === undefined) return;
    expect(nameService.address).toBeDefined();
    if (nameService.address === undefined) return;
    const nft1 = MinaNFT.fromJSON({
      metadataURI: data,
      nameServiceAddress: nameService.address,
    });
    /*
    console.log(
      "nft1",
      nft1.exportToString({ increaseVersion: false, includePrivateData: true })
    );
      */
    const mintdata = nft.exportToString({
      increaseVersion: false,
      includePrivateData: false,
    });
    const nft2 = MinaNFT.fromJSON({
      metadataURI: mintdata,
      nameServiceAddress: nameService.address,
      skipCalculatingMetadataRoot: true,
    });
    /*
    console.log(
      "nft2",
      nft2.exportToString({ increaseVersion: false, includePrivateData: true })
    );

    console.log(`nft:`);
    */
    Memory.info(`created`);
  });

  it(`should mint NFT using nft imported from JSON`, async () => {
    expect(nft).toBeDefined();
    if (nft === undefined) return;
    expect(deployer).toBeDefined();
    if (deployer === undefined) return;
    expect(nameService).toBeDefined();
    if (nameService === undefined) return;
    expect(oraclePrivateKey).toBeDefined();
    if (oraclePrivateKey === undefined) return;
    expect(nameService).toBeDefined();
    if (nameService === undefined) return;
    expect(nameService.address).toBeDefined();
    if (nameService.address === undefined) return;
    const ownerPrivateKey = PrivateKey.random();
    const ownerPublicKey = ownerPrivateKey.toPublicKey();
    const owner = Poseidon.hash(ownerPublicKey.toFields());

    const uri = nft.exportToString({
      increaseVersion: true,
      includePrivateData: false,
    });
    //console.log("uri", uri);
    const nft3 = MinaNFT.fromJSON({
      metadataURI: uri,
      nameServiceAddress: nameService.address,
      skipCalculatingMetadataRoot: true,
    });
    const tx = await nft3.mint({ nameService, deployer, owner, pinataJWT });
    expect(tx).toBeDefined();
    if (tx === undefined) return;
    Memory.info(`minted`);
    expect(await MinaNFT.wait(tx)).toBe(true);
    expect(await nft3.checkState()).toBe(true);
  });

  it(`should mint NFT using api call`, async () => {
    expect(nft).toBeDefined();
    if (nft === undefined) return;
    const minanft = new api(JWT);
    const uri = nft.exportToString({
      increaseVersion: true,
      includePrivateData: false,
    });
    //console.log("uri", uri);
    const result = await minanft.mint({ uri });
    console.log("mint result", result);
  });
});
