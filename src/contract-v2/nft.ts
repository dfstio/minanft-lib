import {
  Field,
  PublicKey,
  AccountUpdate,
  Bool,
  SmartContract,
  method,
  state,
  State,
  DeployArgs,
  Permissions,
  TokenContract,
  AccountUpdateForest,
  VerificationKey,
  Struct,
  UInt32,
  UInt64,
  Signature,
  Provable,
} from "o1js";
import { Metadata } from "../contract/metadata";
import { Storage } from "../contract/metadata";
import { getNetworkIdHash } from "../mina";

export const SELL_FEE = 1_000_000_000n;
export const TRANSFER_FEE = 1_000_000_000n;
export const UPDATE_FEE = 1_000_000_000n;
export const wallet = PublicKey.fromBase58(
  "B62qq7ecvBQZQK68dwstL27888NEKZJwNXNFjTyu3xpQcfX5UBivCU6"
);

export class MetadataParams extends Struct({
  metadata: Metadata,
  storage: Storage,
}) {}

export class SellParams extends Struct({
  address: PublicKey,
  price: UInt64,
}) {}

export class BuyParams extends Struct({
  address: PublicKey,
  price: UInt64,
}) {}

export class TransferParams extends Struct({
  address: PublicKey,
  newOwner: PublicKey,
}) {}

export class MintParams extends Struct({
  name: Field,
  address: PublicKey,
  fee: UInt64,
  feeMaster: PublicKey,
  metadataParams: MetadataParams,
  verificationKey: VerificationKey,
  signature: Signature,
}) {}

export class MintEvent extends Struct({
  name: Field,
  address: PublicKey,
  metadataParams: MetadataParams,
}) {}

export class UpdateParams extends Struct({
  address: PublicKey,
  metadataParams: MetadataParams,
  // TODO: Update proof with sideloaded verification key??
}) {}

export class NFTparams extends Struct({
  price: UInt64,
  version: UInt32,
  // TODO: add more fields
  // isUpdated: Bool,
  // isAddedOnly: Bool,
}) {
  pack(): Field {
    const price = this.price.value.toBits(64);
    const version = this.version.value.toBits(32);
    return Field.fromBits([...price, ...version]);
  }
  static unpack(packed: Field) {
    const bits = packed.toBits(64 + 32);
    const price = UInt64.from(0);
    price.value = Field.fromBits(bits.slice(0, 64));
    const version = UInt32.from(0);
    version.value = Field.fromBits(bits.slice(64, 64 + 32));
    return new NFTparams({ price, version });
  }
}

export class NFTContractV2 extends SmartContract {
  @state(Field) name = State<Field>();
  @state(MetadataParams) metadataParams = State<MetadataParams>();
  @state(PublicKey) owner = State<PublicKey>();
  @state(Field) data = State<Field>();

  @method async update(params: UpdateParams) {
    const { metadataParams } = params;
    const sender = this.sender.getAndRequireSignature();
    this.owner.getAndRequireEquals().assertEquals(sender);
    this.metadataParams.set(metadataParams);
    const data = NFTparams.unpack(this.data.getAndRequireEquals());
    this.data.set(
      new NFTparams({
        price: data.price,
        version: data.version.add(1),
      }).pack()
    );
  }

  @method async sell(price: UInt64) {
    const sender = this.sender.getAndRequireSignature();
    this.owner.getAndRequireEquals().assertEquals(sender);
    const data = NFTparams.unpack(this.data.getAndRequireEquals());
    this.data.set(
      new NFTparams({
        price: price,
        version: data.version.add(1),
      }).pack()
    );
  }

  @method.returns(PublicKey)
  async buy(price: UInt64) {
    const owner = this.owner.getAndRequireEquals();
    const buyer = this.sender.getAndRequireSignature();
    const data = NFTparams.unpack(this.data.getAndRequireEquals());
    data.price.equals(UInt64.from(0)).assertFalse(); // the NFT is for sale
    data.price.assertEquals(price); // price is correct

    this.owner.set(buyer);
    this.data.set(
      new NFTparams({
        price: UInt64.from(0),
        version: data.version.add(1),
      }).pack()
    );
    return owner;
  }

  @method async transferNFT(newOwner: PublicKey) {
    const sender = this.sender.getAndRequireSignature();
    this.owner.getAndRequireEquals().assertEquals(sender);
    const data = NFTparams.unpack(this.data.getAndRequireEquals());
    this.owner.set(newOwner);
    this.data.set(
      new NFTparams({
        price: UInt64.from(0),
        version: data.version.add(1),
      }).pack()
    );
  }
}

export class NameContractV2 extends TokenContract {
  @state(UInt64) priceLimit = State<UInt64>();
  @state(PublicKey) oracle = State<PublicKey>();
  @state(Field) verificationKeyHash = State<Field>(); // TODO: create test with wrong verification key

  async deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.signature(),
    });
  }

  events = {
    mint: MintEvent,
    update: UpdateParams,
    sell: SellParams,
    buy: BuyParams,
    transfer: TransferParams,
    oracle: PublicKey,
    limit: UInt64,
    verificationKey: Field,
  };

  async approveBase(forest: AccountUpdateForest) {
    throw Error(
      "transfers of tokens are not allowed, change the owner instead"
    );
  }

  @method async setOracle(oracle: PublicKey) {
    this.oracle.set(oracle);
    this.emitEvent("oracle", oracle);
  }

  @method async setPriceLimit(limit: UInt64) {
    this.priceLimit.set(limit);
    this.emitEvent("limit", limit);
  }

  @method async setVerificationKeyHash(verificationKeyHash: Field) {
    this.verificationKeyHash.set(verificationKeyHash);
    this.emitEvent("verificationKey", verificationKeyHash);
  }

  @method async mint(params: MintParams) {
    const {
      name,
      address,
      fee,
      feeMaster,
      metadataParams,
      verificationKey,
      signature,
    } = params;
    const oracle = this.oracle.getAndRequireEquals();
    const owner = this.sender.getAndRequireSignature();
    signature
      .verify(oracle, [
        ...owner.toFields(),
        name,
        fee.value,
        ...feeMaster.toFields(),
        ...this.address.toFields(),
        getNetworkIdHash(),
      ])
      .assertEquals(true);
    this.verificationKeyHash
      .getAndRequireEquals()
      .assertEquals(verificationKey.hash);
    const ownerUpdate = AccountUpdate.createSigned(owner);
    ownerUpdate.send({ to: feeMaster, amount: fee });

    const tokenId = this.deriveTokenId();
    const update = AccountUpdate.createSigned(address, tokenId);
    update.account.isNew.getAndRequireEquals().assertTrue();
    this.internal.mint({ address, amount: 1_000_000_000 });

    update.body.update.verificationKey = {
      isSome: Bool(true),
      value: verificationKey,
    };
    update.body.update.permissions = {
      isSome: Bool(true),
      value: {
        ...Permissions.default(),
      },
    };
    const state = [
      name,
      ...MetadataParams.toFields(metadataParams),
      ...owner.toFields(),
      new NFTparams({
        price: UInt64.from(0),
        version: UInt32.from(1),
      }).pack(),
    ];
    update.body.update.appState = state.map((field) => ({
      isSome: Bool(true),
      value: field,
    }));
    this.emitEvent("mint", {
      name,
      address,
      metadataParams,
    });
  }

  @method async update(params: UpdateParams) {
    const { address } = params;
    const sender = this.sender.getAndRequireSignature();
    const ownerUpdate = AccountUpdate.createSigned(sender);
    ownerUpdate.send({ to: wallet, amount: UPDATE_FEE });
    const tokenId = this.deriveTokenId();
    const nft = new NFTContractV2(address, tokenId);
    await nft.update(params);
    this.emitEvent("update", params);
  }

  @method async sell(params: SellParams) {
    params.price.assertLessThanOrEqual(this.priceLimit.getAndRequireEquals());
    await this.internalSell(params);
  }

  @method async sellWithKYC(
    params: SellParams,
    signature: Signature,
    expiry: UInt64
  ) {
    const timestamp = this.network.timestamp.getAndRequireEquals();
    timestamp.assertLessThan(expiry);
    signature
      .verify(this.oracle.getAndRequireEquals(), [
        ...this.address.toFields(),
        ...params.address.toFields(),
        params.price.value,
        ...this.sender.getAndRequireSignature().toFields(),
        expiry.value,
        getNetworkIdHash(),
        Field(1),
      ])
      .assertTrue();
    // TODO: check expiry date
    await this.internalSell(params);
  }

  @method async buy(params: BuyParams) {
    params.price.assertLessThanOrEqual(this.priceLimit.getAndRequireEquals());
    await this.internalBuy(params);
  }

  @method async buyWithKYC(
    params: BuyParams,
    signature: Signature,
    expiry: UInt64
  ) {
    const timestamp = this.network.timestamp.getAndRequireEquals();
    timestamp.assertLessThan(expiry);
    signature
      .verify(this.oracle.getAndRequireEquals(), [
        ...this.address.toFields(),
        ...params.address.toFields(),
        params.price.value,
        ...this.sender.getAndRequireSignature().toFields(),
        expiry.value,
        getNetworkIdHash(),
        Field(2),
      ])
      .assertTrue();
    await this.internalBuy(params);
  }

  private async internalSell(params: SellParams) {
    const { address, price } = params;
    const sender = this.sender.getAndRequireSignature();
    const ownerUpdate = AccountUpdate.createSigned(sender);
    ownerUpdate.send({ to: wallet, amount: SELL_FEE });
    const tokenId = this.deriveTokenId();
    const nft = new NFTContractV2(address, tokenId);
    await nft.sell(price);
    this.emitEvent("sell", params);
  }

  private async internalBuy(params: BuyParams) {
    const { address, price } = params;
    const buyer = this.sender.getAndRequireSignature();
    const tokenId = this.deriveTokenId();
    const nft = new NFTContractV2(address, tokenId);
    const seller = await nft.buy(price);
    const commission = price.div(UInt64.from(10));
    const payment = price.sub(commission);
    const buyerUpdate = AccountUpdate.createSigned(buyer);
    buyerUpdate.send({ to: seller, amount: payment });
    buyerUpdate.send({ to: wallet, amount: commission });
    this.emitEvent("buy", params);
  }

  /*
  private mintPrice(name: Field): UInt64 {
    const price: UInt64 = Provable.if(
      name.greaterThan(Field(BigInt(2 ** 43))),
      UInt64.from(10_000_000_000n),
      Provable.if(
        name.lessThan(Field(BigInt(2 ** 27))),
        UInt64.from(99_000_000_000n),
        UInt64.from(19_000_000_000n)
      )
    );
    return price;
  }
  */

  @method async transferNFT(params: TransferParams) {
    const { address, newOwner } = params;
    const sender = this.sender.getAndRequireSignature();
    const ownerUpdate = AccountUpdate.createSigned(sender);
    ownerUpdate.send({ to: wallet, amount: TRANSFER_FEE });
    const tokenId = this.deriveTokenId();
    const nft = new NFTContractV2(address, tokenId);
    await nft.transferNFT(newOwner);
    this.emitEvent("transfer", params);
  }
}
