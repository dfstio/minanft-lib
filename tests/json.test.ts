import { describe, expect, it } from "@jest/globals";
import { PrivateKey, PublicKey, Poseidon } from "o1js";

import { MinaNFT } from "../src/minanft";
import { MinaNFTNameService } from "../src/minanftnames";
import { blockchain, initBlockchain } from "../utils/testhelpers";
import { PINATA_JWT } from "../env.json";
import { MapData } from "../src/storage/map";
import { Memory } from "../src/mina";

const pinataJWT = PINATA_JWT;
const blockchainInstance: blockchain = "local";

let deployer: PrivateKey | undefined = undefined;
let nameService: MinaNFTNameService | undefined = undefined;
let oraclePrivateKey: PrivateKey | undefined = undefined;
let nftPublicKey: PublicKey | undefined = undefined;
const nftName = `@test`;
// eslint-disable-next-line @typescript-eslint/no-inferrable-types, @typescript-eslint/no-unused-vars
let metadataURI: string = "";

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
    MinaNFT.setCacheFolder("./cache");
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
    const nftPrivateKey = PrivateKey.random();
    nftPublicKey = nftPrivateKey.toPublicKey();
    const ownerPrivateKey = PrivateKey.random();
    const ownerPublicKey = ownerPrivateKey.toPublicKey();
    const owner = Poseidon.hash(ownerPublicKey.toFields());

    const nft = new MinaNFT({
      name: nftName,
      address: nftPublicKey,
      owner,
      nameService: nameService.address,
    });
    nft.updateText({
      key: `description`,
      text: "This is my long description of the NFT. Can be of any length, supports markdown.",
    });
    nft.update({ key: `twitter`, value: `@builder` });
    /*
    nft.update({ key: `secret`, value: `mysecretvalue`, isPrivate: true });
    */
    await nft.updateImage({
      filename: "./images/navigator.jpg",
      pinataJWT,
      calculateRoot: false,
    });

    await nft.updateFile({
      key: "sea",
      filename: "./images/image.jpg",
      pinataJWT,
      calculateRoot: false,
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
      calculateRoot: false,
    });

    const mapLevel3 = new MapData();
    mapLevel3.update({ key: `level3-1`, value: `value31` });
    mapLevel3.update({ key: `level3-2`, value: `value32` });
    mapLevel3.update({ key: `level3-3`, value: `value33` });
    map.updateMap({ key: `level2-4`, map: mapLevel3 });
    nft.updateMap({ key: `level 2 and 3 data`, map });

    metadataURI = JSON.stringify(nft.toJSON(), null, 2);
    //console.log(`metadataURI:`, metadataURI);
    const tx = await nft.mint({ nameService, deployer, owner, pinataJWT });
    expect(tx).toBeDefined();
    if (tx === undefined) return;
    Memory.info(`minted`);
    expect(await MinaNFT.wait(tx)).toBe(true);
    expect(await nft.checkState()).toBe(true);
  });

  /*
  it(`should load NFT from the blockchain`, async () => {
    expect(nftPublicKey).toBeDefined();
    if (nftPublicKey === undefined) return;
    expect(nameService).toBeDefined();
    if (nameService === undefined) return;
    expect(nameService.address).toBeDefined();
    if (nameService.address === undefined) return;
    console.log( `nameService.address:`, nameService.address.toBase58());
    console.log( `nftPublicKey:`, nftPublicKey.toBase58());

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
  */
});
