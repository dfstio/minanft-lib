import { describe, expect, it } from "@jest/globals";
import { PrivateKey, PublicKey, Poseidon, Signature, Field } from "o1js";

import { MinaNFT } from "../src/minanft";
import { MinaNFTNameService } from "../src/minanftnames";
import { blockchain, initBlockchain } from "../utils/testhelpers";
import { Memory } from "../src/mina";
import { PINATA_JWT } from "../env.json";
import { MapData } from "../src/storage/map";
import { MinaNFTCommitData } from "../src/update";

const pinataJWT = PINATA_JWT;
const blockchainInstance: blockchain = "local";

let deployer: PrivateKey | undefined = undefined;
let nameService: MinaNFTNameService | undefined = undefined;
let oraclePrivateKey: PrivateKey | undefined = undefined;
let ownerPrivateKey: PrivateKey | undefined = undefined;
let nftPublicKey: PublicKey | undefined = undefined;
const nftName = `@test`;
// eslint-disable-next-line @typescript-eslint/no-inferrable-types
let metadataURI: string = "";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let commitData: MinaNFTCommitData | undefined = undefined;

beforeAll(async () => {
  const data = await initBlockchain(blockchainInstance, 0);
  expect(data).toBeDefined();
  if (data === undefined) return;

  const { deployer: d } = data;
  deployer = d;
  expect(deployer).toBeDefined();
  if (deployer === undefined) return;
});

describe(`MinaNFT contract`, () => {
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

  it(`should mint NFT`, async () => {
    expect(deployer).toBeDefined();
    if (deployer === undefined) return;
    expect(nameService).toBeDefined();
    if (nameService === undefined) return;
    expect(oraclePrivateKey).toBeDefined();
    if (oraclePrivateKey === undefined) return;
    ownerPrivateKey = PrivateKey.random();
    const ownerPublicKey = ownerPrivateKey.toPublicKey();
    const owner = Poseidon.hash(ownerPublicKey.toFields());
    const nftPrivateKey = PrivateKey.random();
    nftPublicKey = nftPrivateKey.toPublicKey();

    const nft = new MinaNFT({ name: nftName, address: nftPublicKey, owner });
    nft.updateText({
      key: `description`,
      text: "This is my long description of the NFT. Can be of any length, supports markdown.",
    });
    nft.update({ key: `twitter`, value: `@builder` });
    /*
    nft.update({ key: `secret`, value: `mysecretvalue`, isPrivate: true });
    
    await nft.updateImage({
      filename: "./images/navigator.jpg",
      pinataJWT,
    });


    const map = new MapData();
    map.update({ key: `level2-1`, value: `value21` });
    map.update({ key: `level2-2`, value: `value22` });
    map.updateText({
      key: `level2-3`,
      text: `This is text on level 2. Can be very long`,
    });

    await map.updateFile({
      key: "woman",
      filename: "./images/woman.png",
      pinataJWT,
    });

    */

    metadataURI = nft.exportToString({
      increaseVersion: true,
      includePrivateData: true,
    });

    console.log(`metadataURI:`, metadataURI);
    const tx = await nft.mint({
      nameService,
      deployer,
      owner,
      pinataJWT,
      privateKey: nftPrivateKey,
    });
    expect(tx).toBeDefined();
    if (tx === undefined) return;
    Memory.info(`minted`);
    expect(await MinaNFT.wait(tx)).toBe(true);
    expect(await nft.checkState()).toBe(true);
  });

  it(`should load NFT from the blockchain`, async () => {
    expect(nftPublicKey).toBeDefined();
    if (nftPublicKey === undefined) return;
    expect(nameService).toBeDefined();
    if (nameService === undefined) return;
    expect(nameService.address).toBeDefined();
    if (nameService.address === undefined) return;

    const nft = new MinaNFT({
      name: nftName,
      address: nftPublicKey,
      nameService: nameService.address,
    });
    await nft.loadMetadata();
    const loadedJson = nft.toJSON();
    console.log(`json:`, JSON.stringify(loadedJson, null, 2));
    expect(await nft.checkState()).toBe(true);
  });

  it(`should create post`, async () => {
    expect(nftPublicKey).toBeDefined();
    if (nftPublicKey === undefined) return;
    expect(nameService).toBeDefined();
    if (nameService === undefined) return;
    expect(nameService.address).toBeDefined();
    if (nameService.address === undefined) return;
    expect(ownerPrivateKey).toBeDefined();
    if (ownerPrivateKey === undefined) return;
    expect(deployer).toBeDefined();
    if (deployer === undefined) return;

    const nft = new MinaNFT({
      name: nftName,
      address: nftPublicKey,
      nameService: nameService.address,
    });
    await nft.loadMetadata(metadataURI);
    const loadedJson = nft.toJSON();
    console.log(`json:`, JSON.stringify(loadedJson, null, 2));
    expect(await nft.checkState()).toBe(true);

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
    nft.updateMap({ key: `postname`, map });
    commitData = await nft.prepareCommitData({
      ownerPublicKey: ownerPrivateKey.toPublicKey(),
      pinataJWT,
      nameServiceAddress: nameService.address,
    });
    expect(commitData).toBeDefined();
    if (commitData === undefined) return;

    const update: Field[] = JSON.parse(commitData.update).update.map(
      (f: string) => Field.fromJSON(f)
    );
    const signature = Signature.create(ownerPrivateKey, update);
    commitData.signature = signature.toBase58();

    Memory.info(`prepared commit data`);
    expect(await nft.checkState()).toBe(true);
  });

  it(`should commit post data`, async () => {
    expect(nftPublicKey).toBeDefined();
    if (nftPublicKey === undefined) return;
    expect(nameService).toBeDefined();
    if (nameService === undefined) return;
    expect(nameService.address).toBeDefined();
    if (nameService.address === undefined) return;
    expect(deployer).toBeDefined();
    if (deployer === undefined) return;
    expect(ownerPrivateKey).toBeDefined();
    if (ownerPrivateKey === undefined) return;
    expect(commitData).toBeDefined();
    if (commitData === undefined) return;

    const tx = await MinaNFT.commitPreparedData({
      deployer,
      preparedCommitData: commitData,
      ownerPublicKey: ownerPrivateKey.toPublicKey().toBase58(),
      nameService,
    });
    expect(tx).toBeDefined();
    if (tx === undefined) return;
    Memory.info(`commited post data`);
    expect(await MinaNFT.wait(tx)).toBe(true);
  });

  it(`should load NFT with post from the blockchain`, async () => {
    expect(nftPublicKey).toBeDefined();
    if (nftPublicKey === undefined) return;
    expect(nameService).toBeDefined();
    if (nameService === undefined) return;
    expect(nameService.address).toBeDefined();
    if (nameService.address === undefined) return;

    const nft = new MinaNFT({
      name: nftName,
      address: nftPublicKey,
      nameService: nameService.address,
    });
    await nft.loadMetadata();
    const loadedJson = nft.toJSON();
    console.log(`json:`, JSON.stringify(loadedJson, null, 2));
    expect(await nft.checkState()).toBe(true);
  });
});
