import { describe, expect, it } from "@jest/globals";
import { PrivateKey, Poseidon, PublicKey } from "o1js";

import { MinaNFT } from "../src/minanft";
import { MinaNFTNameService } from "../src/minanftnames";
import { blockchain, initBlockchain } from "../utils/testhelpers";
import { Memory, sleep } from "../src/mina";
import { PINATA_JWT, NAMES_ORACLE_SK } from "../env.json";
import config from "../src/config";
import { MapData } from "../src/storage/map";

const { MINANFT_NAME_SERVICE } = config;
const pinataJWT = PINATA_JWT;
const useLocalBlockchain = false;
const blockchainInstance: blockchain = useLocalBlockchain ? "local" : "devnet";
const includeFiles = false;
const includeImage = false;

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

describe(`MinaNFT contract`, () => {
  it(`should compile contracts`, async () => {
    MinaNFT.setCacheFolder("./cache");
    console.log(`Compiling...`);
    console.time(`compiled all`);
    await MinaNFT.compile();
    console.timeEnd(`compiled all`);
    Memory.info(`compiled`);
  });

  if (useLocalBlockchain) {
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
  } else {
    it(`should use existing NameService`, async () => {
      oraclePrivateKey = PrivateKey.fromBase58(NAMES_ORACLE_SK);
      const nameServiceAddress = PublicKey.fromBase58(MINANFT_NAME_SERVICE);
      nameService = new MinaNFTNameService({
        oraclePrivateKey,
        address: nameServiceAddress,
      });
    });
  }

  it(`should mint NFT`, async () => {
    expect(deployer).toBeDefined();
    if (deployer === undefined) return;
    expect(nameService).toBeDefined();
    if (nameService === undefined) return;
    expect(oraclePrivateKey).toBeDefined();
    if (oraclePrivateKey === undefined) return;
    const ownerPrivateKey = PrivateKey.random();
    const ownerPublicKey = ownerPrivateKey.toPublicKey();
    const owner = Poseidon.hash(ownerPublicKey.toFields());
    const nftPrivateKey = PrivateKey.random();
    const nftPublicKey = nftPrivateKey.toPublicKey();

    const nft = new MinaNFT({ name: `@test`, owner, address: nftPublicKey });
    nft.updateText({
      key: `description`,
      text: "This is my long description of the NFT. Can be of any length, supports markdown.",
    });
    nft.update({ key: `twitter`, value: `@builder` });
    nft.update({ key: `secret`, value: `mysecretvalue`, isPrivate: true });
    if (includeImage)
      await nft.updateImage({
        filename: "./images/navigator.jpg",
        pinataJWT,
        calculateRoot: false,
      });
    if (includeFiles) {
      await nft.updateFile({
        key: "sea",
        filename: "./images/sea.png",
        pinataJWT,
        calculateRoot: false,
      });
    }
    const map = new MapData();
    map.update({ key: `level2-1`, value: `value21` });
    map.update({ key: `level2-2`, value: `value22` });
    map.updateText({
      key: `level2-3`,
      text: `This is text on level 2. Can be very long`,
    });
    if (includeFiles)
      await map.updateFile({
        key: "woman",
        filename: "./images/woman.png",
        pinataJWT,
        calculateRoot: false,
      });
    const mapLevel3 = new MapData();
    mapLevel3.update({ key: `level3-1`, value: `value31` });
    mapLevel3.update({ key: `level3-2`, value: `value32`, isPrivate: true });
    mapLevel3.update({ key: `level3-3`, value: `value33` });
    map.updateMap({ key: `level2-4`, map: mapLevel3 });
    nft.updateMap({ key: `level 2 and 3 data`, map });

    //console.log(`json:`, JSON.stringify(nft.toJSON(), null, 2));
    const tx = await nft.mint({
      nameService,
      deployer,
      owner,
      pinataJWT,
      privateKey: nftPrivateKey,
    });
    console.log(`tx:`, tx?.hash);
    expect(tx).toBeDefined();
    if (tx === undefined) return;
    Memory.info(`minted`);
    expect(await MinaNFT.wait(tx)).toBe(true);
    await sleep(60000);
    expect(await nft.checkState()).toBe(true);
  });
});
