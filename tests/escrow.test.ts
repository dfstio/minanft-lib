import { describe, expect, it } from "@jest/globals";
import {
  Field,
  PrivateKey,
  Mina,
  Poseidon,
  UInt64,
  PublicKey,
  fetchAccount,
  Account,
} from "o1js";

import { MinaNFT } from "../src/minanft";
import { MinaNFTNameService } from "../src/minanftnames";
import { EscrowTransfer } from "../src/contract/escrow";
import { MinaNFTEscrow } from "../src/escrow";
import { EscrowDeposit } from "../src/plugins/escrow";
import {
  Memory,
  accountBalance,
  blockchain,
  initBlockchain,
} from "../utils/testhelpers";
import { PINATA_JWT } from "../env.json";

const pinataJWT = PINATA_JWT;
const blockchainInstance: blockchain = "testworld2";

let deployer: PrivateKey | undefined = undefined;
const deployers: PrivateKey[] = [];
/*
    Therea are 2 scenarious:
      - seller approves sale (we use it for this test), in this case he should sign the data with new owner public key
      - seller delegates approval to the escrow, in this case the escrow agent will control 
        both sellerPrivateKey and escrowPrivateKey

*/
let sellerPrivateKey: PrivateKey | undefined = undefined;
let sellerPublicKey: PublicKey | undefined = undefined;
let buyerPrivateKey: PrivateKey | undefined = undefined;
let buyerPublicKey: PublicKey | undefined = undefined;
let escrowPrivateKey: PrivateKey | undefined = undefined;
let escrowPublicKey: PublicKey | undefined = undefined;
let escrowHash: Field | undefined = undefined;
const price: UInt64 = UInt64.from(7_000_000_000n);
let escrowData: EscrowTransfer | undefined = undefined;

let nameService: MinaNFTNameService | undefined = undefined;
let oraclePrivateKey: PrivateKey | undefined = undefined;

beforeAll(async () => {
  const data = await initBlockchain(blockchainInstance, 3);
  expect(data).toBeDefined();
  if (data === undefined) return;

  const { deployer: d, deployers: ds } = data;
  deployer = d;
  deployers.push(...ds);
  expect(deployer).toBeDefined();
  expect(deployers[0]).toBeDefined();
  expect(deployers[1]).toBeDefined();
  expect(deployers[2]).toBeDefined();
  if (deployer === undefined) return;
  if (deployers[0] === undefined) return;
  if (deployers[1] === undefined) return;
  if (deployers[2] === undefined) return;
  sellerPrivateKey = deployers[0];
  sellerPublicKey = sellerPrivateKey.toPublicKey();
  buyerPrivateKey = deployers[1];
  buyerPublicKey = buyerPrivateKey.toPublicKey();
  escrowPrivateKey = deployers[2];
  escrowPublicKey = escrowPrivateKey.toPublicKey();
  escrowHash = Poseidon.hash([
    Poseidon.hash(sellerPublicKey.toFields()),
    Poseidon.hash(buyerPublicKey.toFields()),
    Poseidon.hash(escrowPublicKey.toFields()),
  ]);
  expect(sellerPrivateKey).toBeDefined();
  expect(sellerPublicKey).toBeDefined();
  expect(buyerPrivateKey).toBeDefined();
  expect(buyerPublicKey).toBeDefined();
  expect(escrowPrivateKey).toBeDefined();
  expect(escrowPublicKey).toBeDefined();
  expect(escrowHash).toBeDefined();

  escrowData = new EscrowTransfer({
    oldOwner: Poseidon.hash(sellerPublicKey.toFields()),
    newOwner: Poseidon.hash(buyerPublicKey.toFields()),
    name: MinaNFT.stringToField(`@test`),
    escrow: escrowHash,
    version: UInt64.from(2),
    price,
    tokenId: Field(0), // MINA
  });
  expect(escrowData).toBeDefined();
});

describe(`MinaNFT contract`, () => {
  it(`should compile contracts`, async () => {
    console.log(`Compiling...`);
    console.time(`compiled all`);
    await MinaNFT.compile();
    await MinaNFT.compileEscrow();
    console.timeEnd(`compiled all`);
    Memory.info(`compiled`);
  });

  let escrowTx: Mina.TransactionId | undefined = undefined;
  let mintTx: Mina.TransactionId | undefined = undefined;
  let approveTx: Mina.TransactionId | undefined = undefined;
  let depositTx: Mina.TransactionId | undefined = undefined;
  let transferTx: Mina.TransactionId | undefined = undefined;

  let sellerDeposited: EscrowDeposit | undefined = undefined;
  let buyerDeposited: EscrowDeposit | undefined = undefined;

  const escrow = new MinaNFTEscrow();
  const nft = new MinaNFT(`@test`);

  it(`should deploy Escrow contract`, async () => {
    expect(escrowPrivateKey).toBeDefined();
    if (escrowPrivateKey === undefined) return;
    escrowTx = await escrow.deploy(escrowPrivateKey);
    expect(escrowTx).toBeDefined();
  });

  it(`should wait for escrow deploy transaction to be included into the block`, async () => {
    expect(escrowTx).toBeDefined();
    if (escrowTx === undefined) return;
    expect(await MinaNFT.wait(escrowTx)).toBe(true);
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
    expect(sellerPrivateKey).toBeDefined();
    if (sellerPrivateKey === undefined) return;
    nft.update({ key: `description`, value: `my nft @test` });
    nft.update({ key: `twitter`, value: `@builder` });
    const sellerHash = Poseidon.hash(sellerPublicKey!.toFields());

    mintTx = await nft.mint({
      deployer: sellerPrivateKey,
      owner: sellerHash,
      escrow: escrowHash,
      nameService,
      pinataJWT,
    });
    expect(mintTx).toBeDefined();
    Memory.info(`minted`);
  });

  let isKYCpassed = false;

  it(`should wait for KYC to be passed`, async () => {
    // Here escrow agent should check the KYC status of the buyer and the seller
    isKYCpassed = true;
    expect(isKYCpassed).toBe(true);
  });

  it(`should wait for mint transaction to be included into the block`, async () => {
    expect(mintTx).toBeDefined();
    if (mintTx === undefined) return;
    expect(await MinaNFT.wait(mintTx)).toBe(true);
    expect(await nft.checkState()).toBe(true);
  });

  let sellerBalance: UInt64 | undefined = undefined;
  let buyerBalance: UInt64 | undefined = undefined;
  it(`should get the balances of the seller and buyer`, async () => {
    sellerBalance = await accountBalance(sellerPublicKey!);
    buyerBalance = await accountBalance(buyerPublicKey!);
    expect(sellerBalance.toBigInt()).toBeGreaterThan(
      UInt64.from(1_000_000_000n).toBigInt()
    );
    expect(buyerBalance.toBigInt()).toBeGreaterThan(
      UInt64.from(1_000_000_000n).toBigInt()
    );
  });

  it(`seller should approve sale`, async () => {
    const result = await escrow.approveSale(escrowData!, sellerPrivateKey!);
    expect(result).toBeDefined();
    if (result === undefined) return;
    const { tx, deposited } = result;
    expect(tx).toBeDefined();
    if (tx === undefined) return;
    expect(tx.isSuccess).toBe(true);
    approveTx = tx;
    sellerDeposited = deposited;
  });

  it(`buyer should deposit funds`, async () => {
    const result = await escrow.deposit(
      escrowData!,
      buyerPrivateKey!,
      escrowPublicKey!
    );
    expect(result).toBeDefined();
    if (result === undefined) return;
    const { tx, deposited } = result;
    expect(tx).toBeDefined();
    if (tx === undefined) return;
    expect(tx.isSuccess).toBe(true);
    depositTx = tx;
    buyerDeposited = deposited;
  });

  it(`should wait for approve sale transaction to be included into the block`, async () => {
    expect(approveTx).toBeDefined();
    if (approveTx === undefined) return;
    expect(await MinaNFT.wait(approveTx)).toBe(true);
  });

  it(`should wait for deposit transaction to be included into the block`, async () => {
    expect(depositTx).toBeDefined();
    if (depositTx === undefined) return;
    expect(await MinaNFT.wait(depositTx)).toBe(true);
    Memory.info(`deposited and approved`);
  });

  it(`should check the balance of tokens`, async () => {
    expect(nft.address).toBeDefined();
    expect(nameService).toBeDefined();
    if (nameService === undefined) return;
    expect(nameService.address).toBeDefined();
    if (nameService.address === undefined) return;
    expect(sellerDeposited).toBeDefined();
    if (sellerDeposited === undefined) return;
    expect(buyerDeposited).toBeDefined();
    if (buyerDeposited === undefined) return;
    expect(nft.address).toBeDefined();
    if (nft.address === undefined) return;
    expect(nft.tokenId).toBeDefined();
    if (nft.tokenId === undefined) return;
    const tokenId = nft.tokenId;
    await fetchAccount({ publicKey: nft.address, tokenId });
    const hasAccount = Mina.hasAccount(nft.address, tokenId);
    const account = Account(nft.address, tokenId);
    const balance = Mina.getBalance(nft.address, tokenId);
    console.log(
      `Checks result:`,
      hasAccount,
      tokenId.toJSON(),
      account.balance.get().toString(),
      balance.toString()
    );
  });

  it(`escrow should transfer NFT and funds`, async () => {
    expect(nft.address).toBeDefined();
    expect(nameService).toBeDefined();
    if (nameService === undefined) return;
    expect(nameService.address).toBeDefined();
    if (nameService.address === undefined) return;
    expect(sellerDeposited).toBeDefined();
    if (sellerDeposited === undefined) return;
    expect(buyerDeposited).toBeDefined();
    if (buyerDeposited === undefined) return;
    expect(nft.address).toBeDefined();
    if (nft.address === undefined) return;
    expect(nft.tokenId).toBeDefined();
    if (nft.tokenId === undefined) return;

    transferTx = await escrow.transfer({
      data: escrowData!,
      escrow: escrowPrivateKey!,
      sellerDeposited,
      buyerDeposited,
      nft: nft.address,
      nameService: nameService.address,
      tokenId: nft.tokenId,
      seller: sellerPublicKey!,
      buyer: buyerPublicKey!,
      isKYCpassed,
    });
    expect(transferTx).toBeDefined();
    Memory.info(`transferred`);
  });

  it(`should verify the final state of NFT, seller and buyer`, async () => {
    expect(transferTx).toBeDefined();
    if (transferTx === undefined) return;
    expect(await MinaNFT.wait(transferTx)).toBe(true);
    nft.owner = Poseidon.hash(buyerPublicKey!.toFields());
    nft.escrow = Field(0);
    nft.version = nft.version.add(UInt64.from(1));
    expect(await nft.checkState()).toBe(true);
    const newSellerBalance = await accountBalance(sellerPublicKey!);
    const newBuyerBalance = await accountBalance(buyerPublicKey!);
    expect(sellerBalance).toBeDefined();
    if (sellerBalance === undefined) return;
    expect(buyerBalance).toBeDefined();
    if (buyerBalance === undefined) return;

    expect(newSellerBalance.toBigInt()).toBe(
      sellerBalance
        .add(price)
        .sub(await MinaNFT.fee())
        .toBigInt()
    ); // seller gets the price
    expect(newBuyerBalance.toBigInt()).toBe(
      buyerBalance
        .sub(price)
        .sub(await MinaNFT.fee())
        .toBigInt()
    ); // buyer pays the price
    Memory.info(`verified`);
  });
});
