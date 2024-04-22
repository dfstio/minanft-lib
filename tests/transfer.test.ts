/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-inferrable-types */
import { describe, expect, it } from "@jest/globals";
import {
  Field,
  PrivateKey,
  Mina,
  Poseidon,
  Signature,
  UInt64,
  Account,
} from "o1js";

import { MinaNFT } from "../src/minanft";
import { MinaNFTNameService } from "../src/minanftnames";
import { EscrowTransfer, EscrowApproval } from "../src/contract/escrow";
import { blockchain, initBlockchain } from "../utils/testhelpers";
import { Memory } from "../src/mina";
import { MinaNFTContract } from "../src/contract/nft";
import { MinaNFTNameServiceContract } from "../src/contract/names";
import { EscrowTransferVerification } from "../src/contract/transfer";
import { PINATA_JWT } from "../env.json";

const CONTRACTS_NUMBER = 1;
const ITERATIONS_NUMBER = 1;
const pinataJWT = ""; //PINATA_JWT;
const blockchainInstance: blockchain = "local";

let nameService: MinaNFTNameService | undefined = undefined;
let oraclePrivateKey: PrivateKey | undefined = undefined;
let tokenId: Field | undefined = undefined;

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
    console.time("methods analyzed");
    const methods = [
      {
        name: "EscrowTransferVerification",
        result: await EscrowTransferVerification.analyzeMethods(),
        skip: true,
      },
      {
        name: "MinaNFTContract",
        result: await MinaNFTContract.analyzeMethods(),
        skip: false,
      },
      {
        name: "MinaNFTNameServiceContract",
        result: await MinaNFTNameServiceContract.analyzeMethods(),
        skip: false,
      },
    ];

    console.timeEnd("methods analyzed");
    const maxRows = 2 ** 16;
    for (const contract of methods) {
      // calculate the size of the contract - the sum or rows for each method
      const size = Object.values(contract.result).reduce(
        (acc, method) => acc + method.rows,
        0
      );
      // calculate percentage rounded to 0 decimal places
      const percentage = Math.round((size / maxRows) * 100);

      console.log(
        `method's total size for a ${contract.name} is ${size} rows (${percentage}% of max ${maxRows} rows)`
      );
      if (contract.skip !== true)
        for (const method in contract.result) {
          console.log(method, `rows:`, (contract.result as any)[method].rows);
        }
    }

    MinaNFT.setCacheFolder("./cache");
    console.log(`Compiling...`);
    console.time(`compiled all`);
    await MinaNFT.compile();
    console.timeEnd(`compiled all`);
    Memory.info(`compiled`);
  });
  const owners: PrivateKey[] = [];
  const nft: MinaNFT[] = [];
  const txs: Mina.PendingTransaction[] = [];
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
    expect(nameService.address).toBeDefined();
    if (nameService.address === undefined)
      throw new Error(`NameService address is undefined`);
    const contract = new MinaNFTNameServiceContract(nameService.address);
    tokenId = contract.deriveTokenId();
  });

  it(`should mint NFTs`, async () => {
    console.log(`Minting...`);
    expect(deployer).toBeDefined();
    if (deployer === undefined) return;
    for (let i = 0; i < CONTRACTS_NUMBER; i++) {
      const nftPrivateKey = PrivateKey.random();
      const nftPublicKey = nftPrivateKey.toPublicKey();
      const owner: PrivateKey = PrivateKey.random();
      const ownerHash = Poseidon.hash(owner.toPublicKey().toFields());
      nft.push(
        new MinaNFT({ name: `@test`, address: nftPublicKey, owner: ownerHash })
      );
      nft[i].update({ key: `description`, value: `my nft @test` });
      nft[i].update({ key: `twitter`, value: `@builder` });

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

  it(`should wait for mint transactions to be included into the block`, async () => {
    for (let i = 0; i < CONTRACTS_NUMBER; i++) {
      expect(await MinaNFT.wait(txs[i])).toBe(true);
      expect(await nft[i].checkState()).toBe(true);
      const contract = new MinaNFTContract(nft[i].address, tokenId);
      const escrow = contract.escrow.get();
      expect(escrow.toJSON()).toBe("0");
    }
  });

  for (let iteration = 1; iteration <= ITERATIONS_NUMBER; iteration++) {
    it(`should approve escrow, iteration ${iteration}`, async () => {
      console.log(`Approving escrow, iteration ${iteration}...`);
      expect(deployer).toBeDefined();
      if (deployer === undefined) return;

      for (let i = 0; i < CONTRACTS_NUMBER; i++) {
        // update metadata
        const data: EscrowApproval = new EscrowApproval({
          name: MinaNFT.stringToField(nft[i].name),
          escrow,
          version: nft[i].version.add(UInt64.from(1)),
          owner: Poseidon.hash(owners[i].toPublicKey().toFields()),
        });
        //console.log("owner public key", owners[i].toPublicKey().toBase58());
        //console.log("owner private key", owners[i].toBase58());
        const signature = Signature.create(
          owners[i],
          EscrowApproval.toFields(data)
          //[Field(2)]
        );
        const ok = signature
          .verify(owners[i].toPublicKey(), EscrowApproval.toFields(data))
          .toBoolean();
        if (!ok) console.error("signature ok:", ok);
        expect(ok).toBe(true);

        try {
          const tx = await nft[i].approve({
            deployer,
            data,
            signature,
            ownerPublicKey: owners[i].toPublicKey(),
            nameService,
            nonce: nonce++,
          });
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
      for (let i = 0; i < CONTRACTS_NUMBER; i++) {
        expect(await MinaNFT.wait(txs[i])).toBe(true);
        expect(await nft[i].checkState()).toBe(true);
        const contract = new MinaNFTContract(nft[i].address, tokenId);
        const escrow = contract.escrow.get();
        expect(escrow.toJSON()).toBe(escrow.toJSON());
      }
    });
    it(`should transfer NFTs, iteration ${iteration}`, async () => {
      console.log(`Transferring, iteration ${iteration}...`);
      expect(deployer).toBeDefined();
      if (deployer === undefined) return;
      for (let i = 0; i < CONTRACTS_NUMBER; i++) {
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
          EscrowTransfer.toFields(escrowData)
        );
        const signature2 = Signature.create(
          escrowPrivateKey2,
          EscrowTransfer.toFields(escrowData)
        );
        const signature3 = Signature.create(
          escrowPrivateKey3,
          EscrowTransfer.toFields(escrowData)
        );
        const tx = await nft[i].transfer({
          deployer,
          data: escrowData,
          signature1,
          signature2,
          signature3,
          escrow1: escrowPublicKey1,
          escrow2: escrowPublicKey2,
          escrow3: escrowPublicKey3,
          nameService,
          nonce: nonce++,
        });
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
      for (let i = 0; i < CONTRACTS_NUMBER; i++) {
        expect(await MinaNFT.wait(txs[i])).toBe(true);
        expect(await nft[i].checkState()).toBe(true);
      }
      Memory.info(`approved and transferred, iteration ${iteration}`);
    });
  }
  it(`should verify the final state of NFTs`, async () => {
    for (let i = 0; i < CONTRACTS_NUMBER; i++) {
      expect(await MinaNFT.wait(txs[i])).toBe(true);
      expect(await nft[i].checkState()).toBe(true);
    }
  });
});
