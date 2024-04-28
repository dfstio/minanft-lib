import { describe, expect, it } from "@jest/globals";
import { PrivateKey, PublicKey, VerificationKey, verify } from "o1js";

import { RollupNFT } from "../src/rollupnft";
import { Memory } from "../src/mina";
import { PINATA_JWT } from "../env.json";
import { MapData } from "../src/storage/map";
import { RollupNFTCommitData, RollupNFTCommit } from "../src/update";
import { MinaNFTMetadataUpdateProof } from "../src/contract/update";
import { Devnet, Storage } from "../src";

const includeFiles = false;
const includeImage = false;
const pinataJWT = PINATA_JWT;

const address = PrivateKey.random().toPublicKey();
const nft = new RollupNFT({
  name: `Rollup NFT`,
  address,
  external_url: Devnet.explorerAccountUrl + address.toBase58(),
});
let proofData: RollupNFTCommitData | undefined = undefined;
let proof: MinaNFTMetadataUpdateProof | undefined = undefined;
let verificationKey: VerificationKey | undefined = undefined;
let uri: string | undefined = undefined;

describe(`Rollup NFT proofs`, () => {
  it(`should mint Rollup NFT`, async () => {
    nft.update({ key: "name", value: `@rolluptest` });
    nft.updateText({
      key: `address`,
      text: "B62qrjWrAaXV65CZgpfhLdFynbFdyj851cWZPCPvF92mF3ohGDbNAME",
    });
    nft.updateText({
      key: `description`,
      text: "This is my long description of the Rollup NFT. Can be of any length, supports markdown.",
    });
    nft.update({ key: `twitter`, value: `@rollup` });
    if (includeImage)
      await nft.updateImage({
        filename: "./images/image.jpg",
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
    mapLevel3.update({ key: `level3-2`, value: `value32` });
    map.updateMap({ key: `level2-4`, map: mapLevel3 });
    nft.updateMap({ key: `level 2 and 3 data`, map });

    console.log(`nft:`, nft.toJSON());
  });

  it(`should pin to IPFS and prepare proof data`, async () => {
    const commitData: RollupNFTCommit = {
      pinataJWT,
      generateProofData: true,
    };

    proofData = await nft.prepareCommitData(commitData);
    //console.log(`proofData:`, proofData);
  });

  it(`should get URL and uri`, async () => {
    const url = nft.getURL();
    console.log(`Rollup NFT url:`, url);
    uri = nft.storage?.toIpfsHash();
    console.log(`Rollup NFT uri:`, uri);
    expect(uri).toBeDefined();
  });

  it(`should restore Rollup NFT from uri`, async () => {
    expect(uri).toBeDefined();
    if (uri === undefined) {
      console.error(`uri is undefined`);
      return;
    }
    const nft2 = new RollupNFT({ storage: Storage.fromIpfsHash(uri) });
    await nft2.loadMetadata();
    expect(nft2.name).toBe(nft.name);
    expect(nft2.address?.toBase58()).toBe(nft.address?.toBase58());
    expect(nft2.getURL()).toBe(nft.getURL());
    expect(nft2.external_url).toBe(nft.external_url);
    expect(nft2.storage?.toIpfsHash()).toBe(nft.storage?.toIpfsHash());
    expect(nft2.metadataRoot.data.toJSON()).toStrictEqual(
      nft.metadataRoot.data.toJSON()
    );
    expect(nft2.metadataRoot.kind.toJSON()).toStrictEqual(
      nft.metadataRoot.kind.toJSON()
    );
  });

  it(`should restore Rollup NFT from uri and metadata root`, async () => {
    expect(uri).toBeDefined();
    if (uri === undefined) {
      console.error(`uri is undefined`);
      return;
    }
    const nft2 = new RollupNFT({
      storage: Storage.fromIpfsHash(uri),
      root: nft.metadataRoot,
    });
    await nft2.loadMetadata();
    expect(nft2.name).toBe(nft.name);
    expect(nft2.address?.toBase58()).toBe(nft.address?.toBase58());
    expect(nft2.getURL()).toBe(nft.getURL());
    expect(nft2.external_url).toBe(nft.external_url);
    expect(nft2.storage?.toIpfsHash()).toBe(nft.storage?.toIpfsHash());
    expect(nft2.metadataRoot.data.toJSON()).toStrictEqual(
      nft.metadataRoot.data.toJSON()
    );
    expect(nft2.metadataRoot.kind.toJSON()).toStrictEqual(
      nft.metadataRoot.kind.toJSON()
    );
  });

  it(`should compile contracts`, async () => {
    RollupNFT.setCacheFolder("./cache");
    console.log(`Compiling...`);
    verificationKey = await RollupNFT.compile();
    Memory.info(`compiled`);
  });

  it(`should prepare proof of the Rollup NFT updates`, async () => {
    expect(proofData).toBeDefined();
    if (proofData === undefined) {
      console.error(`proofData is undefined`);
      return;
    }
    proof = await RollupNFT.generateProof(proofData, true);
    Memory.info(`proof created`);
    //console.log(`proof:`, proof);
  });

  it(`should verify proof of the Rollup NFT updates`, async () => {
    expect(proof).toBeDefined();
    if (proof === undefined) {
      console.error(`proof is undefined`);
      return;
    }
    expect(verificationKey).toBeDefined();
    if (verificationKey === undefined) {
      console.error(`verificationKey is undefined`);
      return;
    }
    const verified = await verify(proof, verificationKey);
    console.log(`verified:`, verified);
    expect(verified).toBe(true);
  });
});
