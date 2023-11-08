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
  Signature,
  UInt64,
} from "o1js";

import { MinaNFT } from "../src/minanft";
import { EscrowTransfer, EscrowApproval } from "../src/contract/escrow";
import { Memory, blockchain, initBlockchain } from "../utils/testhelpers";

// 'local' or 'berkeley' or 'mainnet'
const blockchainInstance: blockchain = "local";
//const blockchainInstance: blockchain = 'berkeley';
//const blockchainInstance: blockchain = "testworld2";

const DEPLOYERS_NUMBER = 3;
const ITERATIONS_NUMBER = 5;

jest.setTimeout(1000 * 60 * 60 * 24); // 24 hours

class Key extends SmartContract {
  @state(Field) key = State<Field>();

  @method mint(key: Field) {
    this.key.assertEquals(Field(0));
    this.key.set(key);
  }
}

describe(`MinaNFT contract`, () => {
  const deployers: PrivateKey[] = [];

  it(`should initialize blockchain`, async () => {
    const data = await initBlockchain(blockchainInstance, DEPLOYERS_NUMBER);
    expect(data).toBeDefined();
    if (data === undefined) return;
    const { deployers: ds } = data;
    for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
      deployers.push(ds[i]);
    }
  });

  it(`should compile contracts`, async () => {
    console.log(`Compiling...`);
    console.time(`compiled all`);
    await Key.compile();
    await MinaNFT.compile();
    console.timeEnd(`compiled all`);
    Memory.info(`compiled`);
  });
  const owners: PrivateKey[] = [];
  const nft: MinaNFT[] = [];
  const txs: Mina.TransactionId[] = [];
  const escrowPrivateKey1 = PrivateKey.random();
  const escrowPublicKey1 = escrowPrivateKey1.toPublicKey();
  const escrowPrivateKey2 = PrivateKey.random();
  const escrowPublicKey2 = escrowPrivateKey2.toPublicKey();
  const escrowPrivateKey3 = PrivateKey.random();
  const escrowPublicKey3 = escrowPrivateKey3.toPublicKey();
  const escrow = Poseidon.hash([
    Poseidon.hash(escrowPublicKey1.toFields()),
    Poseidon.hash(escrowPublicKey2.toFields()),
    Poseidon.hash(escrowPublicKey3.toFields()),
  ]);

  it(`should mint NFTs`, async () => {
    //console.log(`Minting...`);
    for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
      nft.push(new MinaNFT(`@test`));
      nft[i].update({ key: `description`, value: `my nft @test` });
      nft[i].update({ key: `twitter`, value: `@builder` });
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
    }
  });

  for (let iteration = 1; iteration <= ITERATIONS_NUMBER; iteration++) {
    it(`should approve escrow, iteration ${iteration}`, async () => {
      //console.log(`Updating and issuing badges, iteration ${iteration}...`);

      for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
        // update metadata
        const data: EscrowApproval = new EscrowApproval({
          name: MinaNFT.stringToField(nft[i].name),
          escrow,
          version: nft[i].version.add(UInt64.from(1)),
          owner: Poseidon.hash(owners[i].toPublicKey().toFields()),
        });
        const signature = Signature.create(owners[i], data.toFields());

        try {
          const tx = await nft[i].approve(
            deployers[i],
            data,
            signature,
            owners[i].toPublicKey()
          );
          expect(tx).toBeDefined();
          if (tx === undefined) return;
          txs[i] = tx;
        } catch (e) {
          console.log(`Commit failed`, e);
          Memory.info(`Commit failed`);
        }
      }
    });

    it(`should wait for approve transactions to be included into the block, iteration ${iteration}`, async () => {
      for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
        expect(await MinaNFT.wait(txs[i])).toBe(true);
        expect(await nft[i].checkState()).toBe(true);
      }
    });

    it(`should transfer NFTs, iteration ${iteration}`, async () => {
      for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
        const ownerHash = Poseidon.hash(owners[i].toPublicKey().toFields());
        const newOwnerPrivateKey = PrivateKey.random();
        const newOwnerPublicKey = newOwnerPrivateKey.toPublicKey();
        const newOwnerHash = Poseidon.hash(newOwnerPublicKey.toFields());
        const version = nft[i].version.add(UInt64.from(1));
        const escrowData = new EscrowTransfer({
          oldOwner: ownerHash,
          newOwner: newOwnerHash,
          name: MinaNFT.stringToField(nft[i].name),
          escrow,
          version,
          price: UInt64.from(0),
          tokenId: Field(0),
        });
        const signature1 = Signature.create(
          escrowPrivateKey1,
          escrowData.toFields()
        );
        const signature2 = Signature.create(
          escrowPrivateKey2,
          escrowData.toFields()
        );
        const signature3 = Signature.create(
          escrowPrivateKey3,
          escrowData.toFields()
        );
        const tx = await nft[i].transfer(
          deployers[i],
          escrowData,
          signature1,
          signature2,
          signature3,
          escrowPublicKey1,
          escrowPublicKey2,
          escrowPublicKey3
        );
        expect(tx).toBeDefined();
        if (tx === undefined) return;
        txs[i] = tx;
        owners[i] = newOwnerPrivateKey;
        expect(tx).toBeDefined();
        if (tx === undefined) return;
        txs[i] = tx;
      }
    });

    it(`should wait for transfer transactions to be included into the block, iteration ${iteration}`, async () => {
      for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
        expect(await MinaNFT.wait(txs[i])).toBe(true);
        expect(await nft[i].checkState()).toBe(true);
      }
      Memory.info(`approved and transferred, iteration ${iteration}`);
    });
  }
  it(`should verify the final state of NFTs`, async () => {
    for (let i = 0; i < DEPLOYERS_NUMBER; i++) {
      expect(await MinaNFT.wait(txs[i])).toBe(true);
      expect(await nft[i].checkState()).toBe(true);
    }
  });
});
