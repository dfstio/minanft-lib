import { describe, expect, it } from "@jest/globals";
import {
  PrivateKey,
  Poseidon,
  PublicKey,
  verify,
  Field,
  JsonProof,
} from "o1js";

import { MinaNFT } from "../src/minanft";
import { MinaNFTNameService } from "../src/minanftnames";
import { RedactedMinaNFT } from "../src/redactedminanft";
import { RedactedMinaNFTMapStateProof } from "../src/plugins/redactedmap";
import { blockchain, initBlockchain } from "../utils/testhelpers";
import { Memory } from "../src/mina";
//import { PINATA_JWT, JWT, NAMES_ORACLE_SK } from "../env.json";
//import { MINANFT_NAME_SERVICE } from "../src/config.json";

const pinataJWT = ""; // PINATA_JWT;
const blockchainInstance: blockchain = "local";
const includeFiles = false;
const includeImage = false;

let deployer: PrivateKey | undefined = undefined;
let nameService: MinaNFTNameService | undefined = undefined;
let oraclePrivateKey: PrivateKey | undefined = undefined;
let verifier: PublicKey | undefined = undefined;
//let mapProof: RedactedMinaNFTMapStateProof | undefined = undefined;
// eslint-disable-next-line @typescript-eslint/no-inferrable-types
let proofString: string = "";
let tokenId: Field | undefined = undefined;
let nftAddress: PublicKey | undefined = undefined;

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
  let originalNFT: MinaNFT | undefined = undefined;
  let redactedNFT: RedactedMinaNFT | undefined = undefined;

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

  /*
  it(`should use existing NameService`, async () => {
    oraclePrivateKey = PrivateKey.fromBase58(NAMES_ORACLE_SK);
    const nameServiceAddress = PublicKey.fromBase58(MINANFT_NAME_SERVICE);
    nameService = new MinaNFTNameService({
      oraclePrivateKey,
      address: nameServiceAddress,
    });
  });
  */

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
    nft.update({ key: `key1`, value: `value2` });
    nft.update({ key: `secret1`, value: `mysecretvalue1`, isPrivate: true });
    nft.update({ key: `secret2`, value: `mysecretvalue2`, isPrivate: true });
    if (includeImage)
      await nft.updateImage({
        filename: "./images/navigator.jpg",
        pinataJWT,
      });
    if (includeFiles) {
      await nft.updateFile({
        key: "sea",
        filename: "./images/sea.png",
        pinataJWT,
      });
    }

    //console.log(`json:`, JSON.stringify(nft.toJSON(), null, 2));
    const tx = await nft.mint({ nameService, deployer, owner, pinataJWT });
    expect(tx).toBeDefined();
    if (tx === undefined) return;
    Memory.info(`minted`);
    expect(await MinaNFT.wait(tx)).toBe(true);
    expect(await nft.checkState()).toBe(true);
    originalNFT = nft;
    tokenId = nft.tokenId;
    nftAddress = nft.address;
  });

  it(`should create and verify redacted NFT`, async () => {
    expect(originalNFT).toBeDefined();
    if (originalNFT === undefined) return;
    redactedNFT = new RedactedMinaNFT(originalNFT);
    expect(redactedNFT).toBeDefined();
    if (redactedNFT === undefined) return;
    redactedNFT.copyMetadata("twitter");
    redactedNFT.copyMetadata("secret1");
    const proof = await redactedNFT.proof();
    expect(MinaNFT.redactedMapVerificationKey).toBeDefined();
    if (MinaNFT.redactedMapVerificationKey === undefined) return;
    const verificationResult: boolean = await verify(
      proof.toJSON(),
      MinaNFT.redactedMapVerificationKey
    );
    expect(verificationResult).toBe(true);
    //mapProof = proof;
    proofString = JSON.stringify(proof.toJSON());
  });

  it(`should verify proof string`, async () => {
    expect(proofString).not.toBe("");
    if (proofString === "") return;
    expect(MinaNFT.redactedMapVerificationKey).toBeDefined();
    if (MinaNFT.redactedMapVerificationKey === undefined) return;
    const proof: RedactedMinaNFTMapStateProof =
      await RedactedMinaNFTMapStateProof.fromJSON(
        JSON.parse(proofString) as JsonProof
      );
    const verificationResult: boolean = await verify(
      proof.toJSON(),
      MinaNFT.redactedMapVerificationKey
    );
    expect(verificationResult).toBe(true);
    //mapProof = proof;
    proofString = JSON.stringify(proof.toJSON());
  });

  it(`should deploy MinaNFTVerifier`, async () => {
    expect(deployer).toBeDefined();
    if (deployer === undefined) return;
    const verifierPrivateKey = PrivateKey.random();
    verifier = verifierPrivateKey.toPublicKey();
    const tx = await RedactedMinaNFT.deploy(deployer, verifierPrivateKey);
    expect(tx).toBeDefined();
    if (tx === undefined) return;
    Memory.info(`verifier deployed`);
    expect(await MinaNFT.wait(tx)).toBe(true);
  });

  it(`should verify proof on-chain`, async () => {
    expect(deployer).toBeDefined();
    if (deployer === undefined) return;
    expect(nameService).toBeDefined();
    if (nameService === undefined) return;
    expect(nameService.address).toBeDefined();
    if (nameService.address === undefined) return;
    expect(verifier).toBeDefined();
    if (verifier === undefined) return;
    expect(tokenId).toBeDefined();
    if (tokenId === undefined) return;
    expect(nftAddress).toBeDefined();
    if (nftAddress === undefined) return;
    expect(proofString).not.toBe("");
    if (proofString === "") return;
    expect(MinaNFT.redactedMapVerificationKey).toBeDefined();
    if (MinaNFT.redactedMapVerificationKey === undefined) return;
    const proof: RedactedMinaNFTMapStateProof =
      await RedactedMinaNFTMapStateProof.fromJSON(
        JSON.parse(proofString) as JsonProof
      );

    const tx = await MinaNFT.verify({
      deployer,
      verifier,
      nft: nftAddress,
      nameServiceAddress: nameService.address,
      proof,
    });
    Memory.info(`verified`);
    expect(tx).toBeDefined();
    if (tx === undefined) return;
    expect(tx.status).toBe("pending");
    expect(await MinaNFT.wait(tx)).toBe(true);
  });
});
