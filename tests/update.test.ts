import { describe, expect, it } from "@jest/globals";
import {
  SmartContract,
  method,
  Field,
  state,
  State,
  PrivateKey,
  Mina,
  Poseidon,
} from "o1js";

import { MinaNFT } from "../src/minanft";
import { MinaNFTBadge } from "../src/minanftbadge";
import {
  makeString,
  Memory,
  blockchain,
  initBlockchain,
} from "../utils/testhelpers";

// 'local' or 'berkeley' or 'mainnet'
const blockchainInstance: blockchain = "local";

const DEPLOYERS_NUMBER = 2;
// hangs on 3rd iteration with 2 deployers or 6th iteration with 1 deployer
const ITERATIONS_NUMBER = 2;

//jest.setTimeout(1000 * 60 * 60 * 24); // 24 hours

class Key extends SmartContract {
  @state(Field) key = State<Field>();

  @method mint(key: Field) {
    this.key.assertEquals(Field(0));
    this.key.set(key);
  }
}

describe(`MinaNFT contract`, () => {
  let deployer: PrivateKey | undefined = undefined;
  const deployers: PrivateKey[] = [];

  it(`should initialize blockchain`, async () => {
    const data = await initBlockchain(blockchainInstance, DEPLOYERS_NUMBER);
    expect(data).toBeDefined();
    if (data === undefined) return;
    const { deployer: d, deployers: ds } = data;
    deployer = d;
    for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
      deployers.push(ds[i]);
    }
  });

  it(`should compile contracts`, async () => {
    console.log(`Compiling...`);
    console.time(`compiled all`);
    await Key.compile();
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
  const oraclePrivateKey = PrivateKey.random();
  const badge = new MinaNFTBadge({
    name: `badgetest`,
    owner: `badgetest`,
    verifiedKey: `twitter`,
    verifiedKind: `string`,
    oracle: oraclePrivateKey.toPublicKey(),
  });

  it(`should deploy Badge contract`, async () => {
    expect(ITERATIONS_NUMBER).toBeGreaterThan(0);
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;
    //console.log(`Deploying MinaNFTBadge...`);
    badgeTx = await badge.deploy(deployer);
    expect(badgeTx).toBeDefined();
    if (badgeTx === undefined) return;
  });

  it(`should mint NFTs`, async () => {
    //console.log(`Minting...`);
    for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
      nft.push(new MinaNFT(`@test`));
      nft[i].update(`description`, `string`, `my nft @test`);
      nft[i].update(`image`, `string`, `ipfs:Qm...`);
      nft[i].update(`twitter`, `string`, `@builder`);
      const owner: PrivateKey = PrivateKey.random();
      const ownerHash = Poseidon.hash(owner.toPublicKey().toFields());

      const tx = await nft[i].mint(deployers[i], ownerHash);
      expect(tx).toBeDefined();
      if (tx === undefined) return;
      txs.push(tx);
      owners.push(owner);
    }
    Memory.info(`minted`);
  });

  it(`should wait for mint transactions to be included into the block`, async () => {
    for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
      expect(await MinaNFT.wait(txs[i])).toBe(true);
      expect(await nft[i].checkState()).toBe(true);
      expect(await badge.verify(nft[i])).toBe(false);
    }
  });

  it(`should check that Badge is deployed`, async () => {
    expect(badgeTx).toBeDefined();
    if (badgeTx === undefined) return;
    expect(await MinaNFT.wait(badgeTx)).toBe(true);
  });

  for (let iteration = 1; iteration <= ITERATIONS_NUMBER; iteration++) {
    it(`should update NFTs, iteration ${iteration}`, async () => {
      //console.log(`Updating and issuing badges, iteration ${iteration}...`);

      for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
        // update metadata
        nft[i].update(`twitter`, `string`, makeString(15));
        nft[i].update(makeString(10), `string`, makeString(15));
        nft[i].update(makeString(10), `string`, makeString(15));
        try {
          const tx = await nft[i].commit(deployers[i], owners[i]); // commit the update to blockchain
          expect(tx).toBeDefined();
          if (tx === undefined) return;
          txs[i] = tx;
        } catch (e) {
          console.log(`Commit failed`, e);
          Memory.info(`Commit failed`);
        }
      }
    });

    it(`should wait for update transactions to be included into the block, iteration ${iteration}`, async () => {
      for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
        expect(await MinaNFT.wait(txs[i])).toBe(true);
        expect(await badge.verify(nft[i])).toBe(false);
        expect(await nft[i].checkState()).toBe(true);
      }
    });

    it(`should issue badges, iteration ${iteration}`, async () => {
      for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
        const tx = await badge.issue(deployers[i], nft[i], oraclePrivateKey);
        expect(tx).toBeDefined();
        if (tx === undefined) return;
        txs[i] = tx;
      }
    });

    it(`should wait for badge transactions to be included into the block, iteration ${iteration}`, async () => {
      for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
        expect(await MinaNFT.wait(txs[i])).toBe(true);
        expect(await badge.verify(nft[i])).toBe(true);
        expect(await nft[i].checkState()).toBe(true);
      }
      Memory.info(`updated and issued badges, iteration ${iteration}`);
    });
  }
  it(`should verify the final state of NFTs`, async () => {
    for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
      expect(await MinaNFT.wait(txs[i])).toBe(true);
      expect(await badge.verify(nft[i])).toBe(true);
      expect(await nft[i].checkState()).toBe(true);
    }
  });
});
