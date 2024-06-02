import { describe, expect, it } from "@jest/globals";
import {
  PrivateKey,
  PublicKey,
  UInt64,
  VerificationKey,
  verify,
  Mina,
  AccountUpdate,
  fetchAccount,
} from "o1js";

import { RollupNFT } from "../../src/rollupnft";
import { MinaNFT } from "../../src/minanft";
import { Memory, accountBalanceMina } from "../../src/mina";
import { PINATA_JWT } from "../../env.json";
import { MapData } from "../../src/storage/map";
import { RollupNFTCommitData, RollupNFTCommit } from "../../src/update";
import { MinaNFTMetadataUpdateProof } from "../../src/contract/update";
import { Devnet, Storage, VERIFICATION_KEY_V2 } from "../../src";
import { updateImage, updateFile } from "../../node/rollup-nft-node";
import {
  NFTContractV2,
  NameContractV2,
  MintParams,
  wallet,
} from "../../src/contract-v2/nft";
import { initBlockchain, accountBalance } from "../../src/mina";
import {
  CONTRACT_DEPLOYER_SK,
  MINANFT_NAME_SERVICE_V2_SK,
  NAMES_ORACLE_SK,
} from "../../env.json";
import config from "../../src/config";
const { MINANFT_NAME_SERVICE_V2, NAMES_ORACLE } = config;
import { MinaNFTNameServiceV2 as MinaNFTNameService } from "../../src/minanftnames2";

const includeFiles = false;
const includeImage = true;
const pinataJWT = PINATA_JWT;

const address = PrivateKey.random().toPublicKey();
const nft = new RollupNFT({
  name: `rollup`,
  address,
  external_url: Devnet.explorerAccountUrl + address.toBase58(),
});
let proofData: RollupNFTCommitData | undefined = undefined;
let proof: MinaNFTMetadataUpdateProof | undefined = undefined;
const verificationKey: VerificationKey = VERIFICATION_KEY_V2;
let uri: string | undefined = undefined;

const useLocalBlockchain: boolean = false;

let deployer: PrivateKey | undefined = undefined;
let sender: PublicKey | undefined = undefined;
let nameService: MinaNFTNameService | undefined = undefined;
let nameServicePrivateKey: PrivateKey | undefined = undefined;
let oraclePrivateKey: PrivateKey = PrivateKey.fromBase58(NAMES_ORACLE_SK);

beforeAll(async () => {
  const data = await initBlockchain(useLocalBlockchain ? "local" : "devnet");
  expect(data).toBeDefined();
  if (data === undefined) return;

  deployer = useLocalBlockchain
    ? data.keys[0].privateKey
    : PrivateKey.fromBase58(CONTRACT_DEPLOYER_SK);
  sender = deployer.toPublicKey();

  console.log("Oracle:", oraclePrivateKey.toPublicKey().toBase58());
  nameServicePrivateKey = PrivateKey.fromBase58(MINANFT_NAME_SERVICE_V2_SK);
  console.log("Sender:", sender.toBase58());
  console.log("Sender balance is", await accountBalanceMina(sender));

  expect(deployer).toBeDefined();
  if (deployer === undefined) return;
  const balanceDeployer =
    Number((await accountBalance(deployer.toPublicKey())).toBigInt()) / 1e9;
  expect(balanceDeployer).toBeGreaterThan(15);
  if (balanceDeployer <= 15) return;
});

describe(`Rollup NFT proofs`, () => {
  it(`should mint Rollup NFT`, async () => {
    nft.update({ key: `collection`, value: `rollup` });
    nft.updateText({
      key: `description`,
      text: "This is my long description of the Rollup NFT. Can be of any length, supports markdown.",
    });
    nft.update({ key: `twitter`, value: `@rollup` });

    if (includeImage)
      await updateImage(nft, {
        filename: "./images/image.jpg",
        pinataJWT,
        calculateRoot: false,
      });
    if (includeFiles) {
      await updateFile(nft, {
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
      await updateFile(nft, {
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

    //console.log(`nft:`, nft.toJSON());
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
    uri = nft.storage?.toIpfsHash();
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
    console.log(`Compiling...`);
    console.time(`compiled all`);
    const vk = (await NFTContractV2.compile()).verificationKey;
    if (vk.hash.toJSON() !== verificationKey.hash.toJSON()) {
      console.error(`Verification key mismatch`);
      console.error(`Expected:`, verificationKey.hash.toJSON());
      console.error(`Received:`, vk.hash.toJSON());
    }
    await NameContractV2.compile();
    console.timeEnd(`compiled all`);
    Memory.info(`compiled`);
  });

  if (useLocalBlockchain) {
    it(`should deploy NameService`, async () => {
      expect(deployer).toBeDefined();
      if (deployer === undefined) return;
      expect(nameServicePrivateKey).toBeDefined();
      if (nameServicePrivateKey === undefined) return;
      expect(oraclePrivateKey).toBeDefined();
      if (oraclePrivateKey === undefined) return;
      const names = new MinaNFTNameService({
        oraclePrivateKey,
      });
      const tx = await names.deploy(deployer, nameServicePrivateKey);
      expect(tx).toBeDefined();
      if (tx === undefined) return;
      Memory.info(`names service deployed`);
      expect(await MinaNFT.wait(tx)).toBe(true);
      nameService = names;
      expect(nameService).toBeDefined();
      if (nameService === undefined) return;
      expect(nameService.address).toBeDefined();
      if (nameService.address === undefined) return;
      expect(nameService.address.toBase58()).toBe(MINANFT_NAME_SERVICE_V2);
    });

    it(`should create wallet account`, async () => {
      if (sender === undefined) throw new Error("Sender is undefined");
      if (deployer === undefined) throw new Error("Deployer is undefined");
      const tx = await Mina.transaction({ sender }, async () => {
        const senderUpdate = AccountUpdate.createSigned(sender!);
        senderUpdate.balance.subInPlace(1_000_000_000);
        senderUpdate.send({ to: wallet, amount: 1_000_000_000 });
      });
      await tx.sign([deployer]).send();
      console.log("Wallet balance is", await accountBalanceMina(wallet));
    });
  } else {
    nameService = new MinaNFTNameService({
      address: PublicKey.fromBase58(MINANFT_NAME_SERVICE_V2),
      oraclePrivateKey: oraclePrivateKey,
    });
    console.log("Name service address:", nameService.address?.toBase58());
    console.log(
      "Oracle:",
      nameService.oraclePrivateKey?.toPublicKey().toBase58()
    );
  }

  it(`should mint NFT`, async () => {
    if (sender === undefined) throw new Error("Sender is undefined");
    if (deployer === undefined) throw new Error("Deployer is undefined");
    if (verificationKey === undefined)
      throw new Error("Verification key is undefined");
    if (nameService === undefined) throw new Error("Name service is undefined");
    const privateKey = PrivateKey.random();
    const address = privateKey.toPublicKey();
    const signature = await nameService.issueNameSignature({
      fee: UInt64.from(1_000_000_000),
      feeMaster: wallet,
      name: MinaNFT.stringToField(nft.name!),
      owner: sender!,
    });
    if (signature === undefined) throw new Error("Signature is undefined");
    const zkAppAddress = PublicKey.fromBase58(MINANFT_NAME_SERVICE_V2);
    const zkApp = new NameContractV2(zkAppAddress);
    /*
        export class MintParams extends Struct({
          name: Field,
          address: PublicKey,
          fee: UInt64,
          feeMaster: PublicKey,
          metadataParams: MetadataParams,
          verificationKey: VerificationKey,
          signature: Signature,
        }) {}
    */
    const mintParams: MintParams = {
      name: MinaNFT.stringToField(nft.name!),
      address,
      fee: UInt64.from(1_000_000_000),
      feeMaster: wallet,
      verificationKey: verificationKey!,
      signature,
      metadataParams: {
        metadata: nft.metadataRoot,
        storage: nft.storage!,
      },
    };
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppAddress });
    const tx = await Mina.transaction(
      { sender, fee: await MinaNFT.fee(), memo: "mint" },
      async () => {
        AccountUpdate.fundNewAccount(sender!);
        await zkApp.mint(mintParams);
      }
    );
    await tx.prove();
    const txSent = await tx.sign([deployer, privateKey]).send();
    console.dir(txSent);
  });
});
