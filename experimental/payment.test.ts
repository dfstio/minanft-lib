import { describe, expect, it } from "@jest/globals";
import {
  Cache,
  Field,
  PublicKey,
  PrivateKey,
  AccountUpdate,
  Signature,
  Bool,
  SmartContract,
  method,
  state,
  State,
  DeployArgs,
  Permissions,
  Mina,
  TokenContract,
  AccountUpdateForest,
  VerificationKey,
  Provable,
  Struct,
  UInt32,
  UInt64,
} from "o1js";
import { accountBalanceMina } from "../src/mina";
const MINT_PRICE = 10_000_000_000n;
const SELL_PRICE = 1_000_000_000n;
const TRANSFER_PRICE = 1_000_000_000n;
const wallet = PublicKey.fromBase58(
  "B62qq7ecvBQZQK68dwstL27888NEKZJwNXNFjTyu3xpQcfX5UBivCU6"
);

class SellParams extends Struct({
  address: PublicKey,
  price: UInt32,
  signature: Signature,
  owner: PublicKey,
  nameService: PublicKey,
}) {}

class NFTBuyParams extends Struct({
  price: UInt64,
  buyer: PublicKey,
  seller: PublicKey,
}) {}

class BuyParams extends Struct({
  address: PublicKey,
  payment: UInt64,
  commission: UInt64,
  buyer: PublicKey,
  seller: PublicKey,
}) {}

class TransferParams extends Struct({
  address: PublicKey,
  signature: Signature,
  owner: PublicKey,
  newOwner: PublicKey,
  nameService: PublicKey,
}) {}

class MintParams extends Struct({
  address: PublicKey,
  owner: PublicKey,
  verificationKey: VerificationKey,
}) {}

class NFTContract extends SmartContract {
  @state(UInt32) price = State<UInt32>();
  @state(PublicKey) owner = State<PublicKey>();
  @state(UInt32) version = State<UInt32>();

  async deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proof(),
    });
  }

  @method async sell(params: SellParams) {
    const { address, price, signature, owner, nameService } = params;
    this.address.assertEquals(address);
    this.owner.getAndRequireEquals().assertEquals(owner);
    const version = this.version.getAndRequireEquals();
    signature
      .verify(owner, [
        ...price.toFields(),
        ...this.address.toFields(),
        ...nameService.toFields(),
        ...version.toFields(),
      ])
      .assertEquals(Bool(true));
    this.price.set(price);
    this.version.set(version.add(1));
  }

  @method async buy(params: NFTBuyParams) {
    const { price, buyer, seller } = params;
    this.owner.getAndRequireEquals().assertEquals(seller);
    const currentPrice = this.price.getAndRequireEquals();
    currentPrice.equals(UInt32.from(0)).assertEquals(Bool(false));
    currentPrice
      .toUInt64()
      .mul(UInt64.from(1_000_000_000))
      .equals(price)
      .assertEquals(Bool(true));

    this.owner.set(buyer);
    this.price.set(UInt32.from(0));
    const version = this.version.getAndRequireEquals();
    this.version.set(version.add(1));
  }

  @method async transferNFT(params: TransferParams) {
    const { signature, owner, newOwner, nameService } = params;
    this.owner.getAndRequireEquals().assertEquals(owner);
    const version = this.version.getAndRequireEquals();

    signature
      .verify(owner, [
        ...newOwner.toFields(),
        ...this.address.toFields(),
        ...nameService.toFields(),
        ...version.toFields(),
      ])
      .assertEquals(Bool(true));
    this.owner.set(newOwner);
    this.version.set(version.add(1));
  }
}

class NameContract extends TokenContract {
  @state(Field) mystate = State<Field>();

  async deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proof(),
    });
  }

  async approveBase(forest: AccountUpdateForest) {
    throw Error(
      "transfers of tokens are not allowed, change the owner instead"
    );
  }

  @method async mint(params: MintParams) {
    const { address, owner, verificationKey } = params;
    const ownerUpdate = AccountUpdate.createSigned(owner);
    ownerUpdate.send({ to: wallet, amount: MINT_PRICE });

    this.internal.mint({ address, amount: 1_000_000_000 });
    const tokenId = this.deriveTokenId();
    const update = AccountUpdate.createSigned(address, tokenId);
    update.body.update.verificationKey = {
      isSome: Bool(true),
      value: verificationKey,
    };
    update.body.update.permissions = {
      isSome: Bool(true),
      value: {
        ...Permissions.default(),
        editState: Permissions.proof(),
      },
    };
    const fields = owner.toFields();
    update.body.update.appState = [
      { isSome: Bool(true), value: Field(0) },
      { isSome: Bool(true), value: fields[0] },
      { isSome: Bool(true), value: fields[1] },
      { isSome: Bool(true), value: Field(0) },
      { isSome: Bool(true), value: Field(0) },
      { isSome: Bool(true), value: Field(0) },
      { isSome: Bool(true), value: Field(0) },
      { isSome: Bool(true), value: Field(0) },
    ];
  }

  @method async sell(params: SellParams) {
    const { address, price, signature, owner, nameService } = params;
    this.address.assertEquals(nameService);
    const ownerUpdate = AccountUpdate.createSigned(owner);
    ownerUpdate.send({ to: wallet, amount: SELL_PRICE });
    const tokenId = this.deriveTokenId();
    const nft = new NFTContract(address, tokenId);
    await nft.sell({
      address,
      price,
      signature,
      owner,
      nameService: this.address,
    });
  }

  @method async buy(params: BuyParams) {
    const { address, payment, commission, buyer, seller } = params;
    const price = payment.add(commission);
    commission.mul(UInt64.from(10)).assertEquals(price);
    const buyerUpdate = AccountUpdate.createSigned(buyer);
    buyerUpdate.send({ to: seller, amount: payment });
    buyerUpdate.send({ to: wallet, amount: commission });
    const tokenId = this.deriveTokenId();
    const nft = new NFTContract(address, tokenId);
    await nft.buy({ price, buyer, seller });
  }

  @method async transferNFT(params: TransferParams) {
    const { address, signature, owner, newOwner, nameService } = params;
    this.address.assertEquals(nameService);
    const ownerUpdate = AccountUpdate.createSigned(owner);
    ownerUpdate.send({ to: wallet, amount: TRANSFER_PRICE });
    const tokenId = this.deriveTokenId();
    const nft = new NFTContract(address, tokenId);
    await nft.transferNFT({
      address,
      signature,
      owner,
      newOwner,
      nameService: this.address,
    });
  }
}

describe("Payment", () => {
  let verificationKey: VerificationKey;
  const local = Mina.LocalBlockchain({
    proofsEnabled: true,
  });
  Mina.setActiveInstance(local);
  const { privateKey: deployer, publicKey: sender } = local.testAccounts[0];
  const owner = local.testAccounts[1];
  const buyer = local.testAccounts[2];
  const zkAppPrivateKey = PrivateKey.random();
  const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
  const zkApp = new NameContract(zkAppPublicKey);
  const tokenId = zkApp.deriveTokenId();
  const nftPrivateKey = PrivateKey.random();
  const nftPublicKey = nftPrivateKey.toPublicKey();
  const nft = new NFTContract(nftPublicKey, tokenId);
  const newOwner = PrivateKey.random().toPublicKey();

  it(`should compile contracts`, async () => {
    const cache: Cache = Cache.FileSystem("./cache");
    console.log("Compiling ...");
    await NameContract.compile({ cache });
    verificationKey = (await NFTContract.compile({ cache })).verificationKey;
  });

  it(`should deploy NameContract`, async () => {
    console.log("Deploying NameContract...");
    const tx = await Mina.transaction({ sender }, async () => {
      AccountUpdate.fundNewAccount(sender);
      await zkApp.deploy({});
    });
    await tx.sign([deployer, zkAppPrivateKey]).send();
  });

  it(`should create wallet account`, async () => {
    const tx = await Mina.transaction({ sender }, async () => {
      const senderUpdate = AccountUpdate.createSigned(sender);
      senderUpdate.balance.subInPlace(1_000_000_000);
      senderUpdate.send({ to: wallet, amount: 1_000_000_000 });
    });
    await tx.sign([deployer]).send();
    console.log("Wallet balance is", await accountBalanceMina(wallet));
  });

  it(`should min NFT`, async () => {
    console.log("Minting NFT...");

    const tx = await Mina.transaction({ sender: owner.publicKey }, async () => {
      AccountUpdate.fundNewAccount(owner.publicKey);
      await zkApp.mint({
        address: nftPublicKey,
        owner: owner.publicKey,
        verificationKey,
      });
    });
    tx.sign([nftPrivateKey, owner.privateKey]);
    await tx.prove();
    await tx.send();
  });

  it(`should sell NFT`, async () => {
    expect(nft.owner.get().toBase58()).toBe(owner.publicKey.toBase58());
    console.log("Wallet balance is", await accountBalanceMina(wallet));

    console.log("Selling...");
    const price = UInt32.from(100);
    const version = nft.version.get();
    const signature = Signature.create(owner.privateKey, [
      ...price.toFields(),
      ...nftPublicKey.toFields(),
      ...zkAppPublicKey.toFields(),
      ...version.toFields(),
    ]);
    const tx = await Mina.transaction({ sender: owner.publicKey }, async () => {
      await zkApp.sell({
        address: nftPublicKey,
        price,
        signature,
        owner: owner.publicKey,
        nameService: zkAppPublicKey,
      });
    });
    tx.sign([owner.privateKey]);
    await tx.prove();
    await tx.send();
    expect(nft.price.get().toBigint()).toBe(price.toBigint());
    console.log("Wallet balance is", await accountBalanceMina(wallet));
  });

  it(`should buy NFT`, async () => {
    console.log("Buying...");
    console.log("Wallet balance is", await accountBalanceMina(wallet));
    console.log("Seller balance is", await accountBalanceMina(owner.publicKey));
    console.log("Buyer balance is", await accountBalanceMina(buyer.publicKey));
    const payment = UInt64.from(90 * 1_000_000_000);
    const commission = UInt64.from(10 * 1_000_000_000);
    const tx = await Mina.transaction({ sender: buyer.publicKey }, async () => {
      await zkApp.buy({
        address: nftPublicKey,
        payment,
        commission,
        buyer: buyer.publicKey,
        seller: owner.publicKey,
      });
    });
    tx.sign([buyer.privateKey]);
    await tx.prove();
    await tx.send();
    expect(nft.price.get().toBigint()).toBe(UInt32.from(0).toBigint());
    expect(nft.owner.get().toBase58()).toBe(buyer.publicKey.toBase58());
    console.log("Wallet balance is", await accountBalanceMina(wallet));
    console.log("Seller balance is", await accountBalanceMina(owner.publicKey));
    console.log("Buyer balance is", await accountBalanceMina(buyer.publicKey));
  });

  it(`should transfer NFT`, async () => {
    expect(nft.owner.get().toBase58()).toBe(buyer.publicKey.toBase58());
    console.log("Transferring...");
    const version = nft.version.get();
    const signature = Signature.create(buyer.privateKey, [
      ...newOwner.toFields(),
      ...nftPublicKey.toFields(),
      ...zkAppPublicKey.toFields(),
      ...version.toFields(),
    ]);
    const tx = await Mina.transaction({ sender: buyer.publicKey }, async () => {
      await zkApp.transferNFT({
        address: nftPublicKey,
        signature,
        owner: buyer.publicKey,
        newOwner,
        nameService: zkAppPublicKey,
      });
    });
    tx.sign([buyer.privateKey]);
    await tx.prove();
    await tx.send();

    console.log("Wallet balance is", await accountBalanceMina(wallet));
    expect(nft.owner.get().toBase58()).toBe(newOwner.toBase58());
  });
});
