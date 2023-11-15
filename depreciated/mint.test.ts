import { describe, expect, it } from "@jest/globals";
import {
  SmartContract,
  method,
  Field,
  state,
  State,
  PrivateKey,
  Poseidon,
} from "o1js";

import { MinaNFT } from "../src/minanft";
import { Memory, blockchain, initBlockchain } from "../utils/testhelpers";
import { PINATA_JWT } from "../env.json";
import { MapData } from "../src/storage/map";

const pinataJWT = PINATA_JWT;
const blockchainInstance: blockchain = "berkeley";

class Key extends SmartContract {
  @state(Field) key = State<Field>();

  @method mint(key: Field) {
    this.key.assertEquals(Field(0));
    this.key.set(key);
  }
}

let deployer: PrivateKey | undefined = undefined;

beforeAll(async () => {
  const data = await initBlockchain(blockchainInstance, 3);
  expect(data).toBeDefined();
  if (data === undefined) return;

  const { deployer: d } = data;
  deployer = d;
  expect(deployer).toBeDefined();
  if (deployer === undefined) return;
});

describe(`MinaNFT contract`, () => {
  it(`should compile contracts`, async () => {
    console.log(`Compiling...`);
    console.time(`compiled all`);
    await Key.compile();
    await MinaNFT.compile();
    console.timeEnd(`compiled all`);
    Memory.info(`compiled`);
  });

  it(`should mint NFT`, async () => {
    expect(deployer).toBeDefined();
    if (deployer === undefined) return;
    const ownerPrivateKey = PrivateKey.random();
    const ownerPublicKey = ownerPrivateKey.toPublicKey();
    const owner = Poseidon.hash(ownerPublicKey.toFields());

    const nft = new MinaNFT(`@test`);
    nft.updateText({
      key: `description`,
      text: "This is my long description of the NFT. Can be of any length, supports markdown.",
    });
    nft.update({ key: `twitter`, value: `@builder` });
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
    const mapLevel3 = new MapData();
    mapLevel3.update({ key: `level3-1`, value: `value31` });
    mapLevel3.update({ key: `level3-2`, value: `value32`, isPrivate: true });
    mapLevel3.update({ key: `level3-3`, value: `value33` });
    map.updateMap({ key: `level2-4`, map: mapLevel3 });
    nft.updateMap({ key: `level 2 and 3 data`, map });

    console.log(`json:`, JSON.stringify(nft.toJSON(), null, 2));
    const tx = await nft.mint(deployer, owner, pinataJWT);
    expect(tx).toBeDefined();
    if (tx === undefined) return;
    Memory.info(`minted`);
    expect(await MinaNFT.wait(tx)).toBe(true);
    expect(await nft.checkState()).toBe(true);
  });
});
