import { describe, expect, it } from "@jest/globals";
import { Account, PrivateKey, Mina, Poseidon } from "o1js";

import { MinaNFT } from "../src/minanft";
import { MinaNFTNameService } from "../src/minanftnames";
import { MinaNFTBadge } from "../src/minanftbadge";
import {
  makeString,
  Memory,
  blockchain,
  initBlockchain,
} from "../utils/testhelpers";
import { PINATA_JWT } from "../env.json";

const CONTRACTS_NUMBER = 1;
const ITERATIONS_NUMBER = 1;
const pinataJWT = ""; //PINATA_JWT;
const blockchainInstance: blockchain = 'local';

let nameService: MinaNFTNameService | undefined = undefined;
let oraclePrivateKey: PrivateKey | undefined = undefined;
let badgeOraclePrivateKey: PrivateKey | undefined = undefined;

let deployer: PrivateKey | undefined = undefined;
let nonce: number = 0;

describe(`MinaNFT contract`, () => {
  it(`should initialize blockchain`, async () => {
    const data = await initBlockchain(blockchainInstance, 0);
    expect(data).toBeDefined();
    if (data === undefined) return;
    const { deployer: d } = data;
    expect(d).toBeDefined();
    deployer = d;
  });

  it(`should compile contracts`, async () => {
    console.log(`Compiling...`);
    console.time(`compiled all`);
    await MinaNFT.compile();
    await MinaNFT.compileBadge();
    await MinaNFT.compileRedactedMap();
    console.timeEnd(`compiled all`);
    Memory.info(`compiled`);
  });
  const owners: PrivateKey[] = [];
  const nft: MinaNFT[] = [];
  const txs: Mina.TransactionId[] = [];
  let badgeTx: Mina.TransactionId | undefined = undefined;
  badgeOraclePrivateKey = PrivateKey.random();
  const badge = new MinaNFTBadge({
    name: `badgetest`,
    owner: `badgetest`,
    verifiedKey: `twitter`,
    verifiedKind: `string`,
    oracle: badgeOraclePrivateKey.toPublicKey(),
    tokenSymbol: `BADGE`,
  });

  it(`should deploy NameService`, async () => {
    expect(deployer).toBeDefined();
    if (deployer === undefined) return;
    const sender = deployer.toPublicKey();
    const account = Account(sender);
    nonce = Number(account.nonce.get().toBigint());
    oraclePrivateKey = PrivateKey.random();
    const names = new MinaNFTNameService({
      oraclePrivateKey,
    });
    const tx = await names.deploy(deployer, undefined, nonce++);
    expect(tx).toBeDefined();
    if (tx === undefined) return;
    Memory.info(`names service deployed`);
    expect(await MinaNFT.wait(tx)).toBe(true);
    nameService = names;
    expect(nameService).toBeDefined();
    if (nameService === undefined) return;
    expect(nameService.tokenId).toBeDefined();
    if (nameService.tokenId === undefined) return;
  });

  it(`should deploy Badge contract`, async () => {
    expect(ITERATIONS_NUMBER).toBeGreaterThan(0);
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;
    console.log(`Deploying MinaNFTBadge...`);
    badgeTx = await badge.deploy(deployer, undefined, nonce++);
    expect(badgeTx).toBeDefined();
    if (badgeTx === undefined) return;
  });

  it(`should mint NFTs`, async () => {
    console.log(`Minting...`);
    expect(deployer).toBeDefined();
    if (deployer === undefined) return;
    for (let i = 0; i < CONTRACTS_NUMBER; i++) {
      nft.push(new MinaNFT({ name: `@test${i}`}));
      nft[i].update({ key: `twitter`, value: `@builder` });
      nft[i].updateText({
        key: `description`,
        text: "This is my long description of the NFT. Can be of any length, supports markdown.",
      });
      const owner: PrivateKey = PrivateKey.random();
      const ownerHash = Poseidon.hash(owner.toPublicKey().toFields());

      const tx = await nft[i].mint({
        deployer,
        owner: ownerHash,
        pinataJWT,
        nameService,
        nonce: nonce++,
      });
      expect(tx).toBeDefined();
      if (tx === undefined) return;
      txs.push(tx);
      owners.push(owner);
    }
    Memory.info(`minted`);
  });

  it(`should check that Badge is deployed`, async () => {
    expect(badgeTx).toBeDefined();
    if (badgeTx === undefined) return;
    expect(await MinaNFT.wait(badgeTx)).toBe(true);
  });

  it(`should wait for mint transactions to be included into the block`, async () => {
    for (let i = 0; i < CONTRACTS_NUMBER; i++) {
      expect(await MinaNFT.wait(txs[i])).toBe(true);
      expect(await nft[i].checkState()).toBe(true);
      expect(await badge.verify(nft[i])).toBe(false);
    }
  });

  for (let iteration = 1; iteration <= ITERATIONS_NUMBER; iteration++) {
    it(`should update NFTs, iteration ${iteration}`, async () => {
      console.log(`Updating and issuing badges, iteration ${iteration}...`);
      expect(deployer).toBeDefined();
      if (deployer === undefined) return;

      for (let i = 0; i < CONTRACTS_NUMBER; i++) {
        // update metadata
        nft[i].update({ key: `twitter`, value: makeString(15) });
        nft[i].update({ key: makeString(10), value: makeString(15) });
        nft[i].update({ key: makeString(10), value: makeString(15) });
        try {
          const tx = await nft[i].commit({
            deployer,
            ownerPrivateKey: owners[i],
            pinataJWT,
            nameService,
            nonce: nonce++,
          }); // commit the update to blockchain
          expect(tx).toBeDefined();
          if (tx === undefined) return;
          txs[i] = tx;
        } catch (e) {
          console.log(`Commit failed`, e);
          Memory.info(`Commit failed`);
        }
      }
      Memory.info(`updated`);
    });

    it(`should wait for update transactions to be included into the block, iteration ${iteration}`, async () => {
      for (let i = 0; i < CONTRACTS_NUMBER; i++) {
        expect(await MinaNFT.wait(txs[i])).toBe(true);
        expect(await badge.verify(nft[i])).toBe(false);
        expect(await nft[i].checkState()).toBe(true);
      }
    });

    it(`should issue badges, iteration ${iteration}`, async () => {
      expect(deployer).toBeDefined();
      if (deployer === undefined) return;
      expect(badgeOraclePrivateKey).toBeDefined();
      if (badgeOraclePrivateKey === undefined) return;

      for (let i = 0; i < CONTRACTS_NUMBER; i++) {
        const tx = await badge.issue(
          deployer,
          nft[i],
          badgeOraclePrivateKey,
          nonce++
        );
        expect(tx).toBeDefined();
        if (tx === undefined) return;
        txs[i] = tx;
      }
    });

    it(`should wait for badge transactions to be included into the block, iteration ${iteration}`, async () => {
      for (let i = 0; i < CONTRACTS_NUMBER; i++) {
        expect(await MinaNFT.wait(txs[i])).toBe(true);
        expect(await badge.verify(nft[i])).toBe(true);
        expect(await nft[i].checkState()).toBe(true);
      }
      Memory.info(`updated and issued badges, iteration ${iteration}`);
    });
  }
  it(`should verify the final state of NFTs`, async () => {
    for (let i = 0; i < CONTRACTS_NUMBER; i++) {
      expect(await badge.verify(nft[i])).toBe(true);
      expect(await nft[i].checkState()).toBe(true);
    }
  });
});
