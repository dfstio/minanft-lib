import { describe, expect, it } from "@jest/globals";
import {
  Cache,
  Field,
  PublicKey,
  PrivateKey,
  AccountUpdate,
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
  Struct,
  UInt32,
  UInt64,
  Signature,
  ZkProgram,
} from "o1js";
import { accountBalanceMina } from "../src/mina";
import { skip } from "node:test";
const MINT_FEE = 10_000_000_000n;
const SELL_FEE = 1_000_000_000n;
const SELL_WITH_KYC_FEE = 50_000_000_000n;
const TRANSFER_FEE = 1_000_000_000n;
const UPDATE_FEE = 1_000_000_000n;
const wallet = PublicKey.fromBase58(
  "B62qq7ecvBQZQK68dwstL27888NEKZJwNXNFjTyu3xpQcfX5UBivCU6"
);

function getNetworkIdHash(): Field {
  return Field(123);
}

class MetadataParams extends Struct({
  data: [Field, Field, Field, Field],
}) {
  constructor() {
    super({
      data: [Field(0), Field(0), Field(0), Field(0)],
    });
  }
}

class SellParams extends Struct({
  address: PublicKey,
  price: UInt64,
}) {}

class BuyParams extends Struct({
  address: PublicKey,
  price: UInt64,
}) {}

class TransferParams extends Struct({
  address: PublicKey,
  newOwner: PublicKey,
}) {}

class MintParams extends Struct({
  name: Field,
  address: PublicKey,
  metadataParams: MetadataParams,
  verificationKey: VerificationKey,
}) {}

class UpdateParams extends Struct({
  address: PublicKey,
  metadataParams: MetadataParams,
}) {}

class NFTparams extends Struct({
  price: UInt64,
  version: UInt32,
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

class NFTContract extends SmartContract {
  @state(Field) name = State<Field>();
  @state(MetadataParams) metadataParams = State<MetadataParams>();
  @state(PublicKey) owner = State<PublicKey>();
  @state(Field) data = State<Field>();

  async deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proof(),
    });
  }

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

class NameContract extends TokenContract {
  @state(UInt64) priceLimit = State<UInt64>();
  @state(PublicKey) oracle = State<PublicKey>();

  async deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.signature(),
    });
  }

  async approveBase(forest: AccountUpdateForest) {
    throw Error(
      "transfers of tokens are not allowed, change the owner instead"
    );
  }

  @method async mint(params: MintParams) {
    const { name, metadataParams, address, verificationKey } = params;
    const owner = this.sender.getAndRequireSignature();
    const ownerUpdate = AccountUpdate.createSigned(owner);
    ownerUpdate.send({ to: wallet, amount: MINT_FEE });

    this.internal.mint({ address, amount: 1_000_000_000 });
    const tokenId = this.deriveTokenId();
    const update = AccountUpdate.createSigned(address, tokenId);

    //TODO: make verification key a constant
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
      ...metadataParams.data,
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
  }

  @method async update(params: UpdateParams) {
    const { address } = params;
    const sender = this.sender.getAndRequireSignature();
    const ownerUpdate = AccountUpdate.createSigned(sender);
    ownerUpdate.send({ to: wallet, amount: UPDATE_FEE });
    const tokenId = this.deriveTokenId();
    const nft = new NFTContract(address, tokenId);
    await nft.update(params);
  }

  @method async sell(params: SellParams) {
    params.price.assertLessThanOrEqual(this.priceLimit.getAndRequireEquals());
    await this.internalSell(params, UInt64.from(SELL_FEE));
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
    await this.internalSell(params, UInt64.from(SELL_WITH_KYC_FEE));
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

  async internalSell(params: SellParams, fee: UInt64) {
    const { address, price } = params;
    const sender = this.sender.getAndRequireSignature();
    const ownerUpdate = AccountUpdate.createSigned(sender);
    ownerUpdate.send({ to: wallet, amount: fee });
    const tokenId = this.deriveTokenId();
    const nft = new NFTContract(address, tokenId);
    await nft.sell(price);
  }

  async internalBuy(params: BuyParams) {
    const { address, price } = params;
    const buyer = this.sender.getAndRequireSignature();
    const tokenId = this.deriveTokenId();
    const nft = new NFTContract(address, tokenId);
    const seller = await nft.buy(price);
    const commission = price.div(UInt64.from(10));
    const payment = price.sub(commission);
    const buyerUpdate = AccountUpdate.createSigned(buyer);
    buyerUpdate.send({ to: seller, amount: payment });
    buyerUpdate.send({ to: wallet, amount: commission });
  }

  @method async transferNFT(params: TransferParams) {
    const { address, newOwner } = params;
    const sender = this.sender.getAndRequireSignature();
    const ownerUpdate = AccountUpdate.createSigned(sender);
    ownerUpdate.send({ to: wallet, amount: TRANSFER_FEE });
    const tokenId = this.deriveTokenId();
    const nft = new NFTContract(address, tokenId);
    await nft.transferNFT(newOwner);
  }
}

export const MetadataUpdate = ZkProgram({
  name: "MetadataUpdate",
  publicInput: Field,

  methods: {
    check: {
      privateInputs: [],
      async method(value: Field) {
        value.assertLessThanOrEqual(Field(100));
      },
    },
  },
});

class MetadataUpdateProof extends ZkProgram.Proof(MetadataUpdate) {}

class TrustedUpdate extends SmartContract {
  @state(PublicKey) contract = State<PublicKey>();

  async deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proof(),
    });
  }

  @method async update(params: UpdateParams, proof: MetadataUpdateProof) {
    params.metadataParams.data[0].assertEquals(proof.publicInput);
    proof.verify();
    const contract = new NameContract(this.contract.getAndRequireEquals());
    await contract.update(params);
  }
}

describe("Payment", () => {
  let verificationKey: VerificationKey;
  const local = Mina.LocalBlockchain({
    proofsEnabled: true,
  });
  Mina.setActiveInstance(local);
  const { privateKey: deployer, publicKey: sender } = local.testAccounts[0];
  const owner1 = local.testAccounts[1];
  let owner = owner1;
  const owner2 = local.testAccounts[2];
  const owner3 = local.testAccounts[3];
  const owner4 = local.testAccounts[4];
  const zkAppPrivateKey = PrivateKey.random();
  const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
  const trusted = PrivateKey.randomKeypair();
  const zkApp = new NameContract(zkAppPublicKey);
  const zkTrusted = new TrustedUpdate(trusted.publicKey);
  const tokenId = zkApp.deriveTokenId();
  const nftPrivateKey = PrivateKey.random();
  const nftPublicKey = nftPrivateKey.toPublicKey();
  const nft = new NFTContract(nftPublicKey, tokenId);
  const price = UInt64.from(100_000_000_000);
  const kycPrice = UInt64.from(200_000_000_000);
  const oracle = PrivateKey.randomKeypair();

  it(`should test NFTparams`, async () => {
    const price = UInt64.from(1);
    const version = UInt32.from(1);
    const params = new NFTparams({ price, version });
    const packed = params.pack();
    const unpacked = NFTparams.unpack(packed);
    expect(unpacked.price.toBigInt()).toBe(BigInt(1));
    expect(unpacked.version.toBigint()).toBe(BigInt(1));

    for (let i = 0; i < 1000; i++) {
      const price = UInt64.from(
        Math.floor(Math.random() * Number(UInt64.MAXINT().toBigInt()))
      );
      const version = UInt32.from(
        Math.floor(Math.random() * Number(UInt32.MAXINT().toBigint()))
      );
      const params = new NFTparams({ price, version });
      const packed = params.pack();
      const unpacked = NFTparams.unpack(packed);
      expect(unpacked.price.toBigInt()).toBe(price.toBigInt());
      expect(unpacked.version.toBigint()).toBe(version.toBigint());
    }
  });

  it(`should compile contracts`, async () => {
    console.log("Compiling ...");
    console.time("compiled NameContract");
    const cache: Cache = Cache.FileSystem("./cache");
    verificationKey = (await NFTContract.compile({ cache })).verificationKey;
    await NameContract.compile({ cache });
    console.timeEnd("compiled NameContract");
    console.time("compiled TrustedUpdate");
    await MetadataUpdate.compile({ cache });
    await TrustedUpdate.compile({ cache });
    console.timeEnd("compiled TrustedUpdate");

    const methods = [
      {
        name: "NFTContract",
        result: await NFTContract.analyzeMethods(),
      },
      { name: "NameContract", result: await NameContract.analyzeMethods() },
      {
        name: "TrustedUpdate",
        result: await TrustedUpdate.analyzeMethods(),
      },
      {
        name: "MetadataUpdate",
        result: await MetadataUpdate.analyzeMethods(),
        skip: true,
      },
    ];
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
      if (contract.skip) continue;
      for (const method in contract.result) {
        console.log(method, `rows:`, (contract.result as any)[method].rows);
      }
    }
  });

  it(`should deploy contracts`, async () => {
    console.log("Deploying contracts...");
    const tx = await Mina.transaction({ sender }, async () => {
      AccountUpdate.fundNewAccount(sender, 2);
      await zkApp.deploy({});
      zkApp.priceLimit.set(UInt64.from(100_000_000_000));
      zkApp.oracle.set(oracle.publicKey);

      await zkTrusted.deploy({});
      zkTrusted.contract.set(zkAppPublicKey);
    });

    tx.sign([zkAppPrivateKey, trusted.privateKey, deployer]);
    await tx.send();
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
    console.time("minted NFT");
    const tx = await Mina.transaction({ sender: owner.publicKey }, async () => {
      AccountUpdate.fundNewAccount(owner.publicKey);
      await zkApp.mint({
        name: Field(1),
        address: nftPublicKey,
        metadataParams: new MetadataParams(),
        owner: owner.publicKey,
        verificationKey,
      });
    });
    tx.sign([nftPrivateKey, owner.privateKey]);
    await tx.prove();
    await tx.send();
    console.timeEnd("minted NFT");
  });

  it(`should update NFT using TrustedUpdate`, async () => {
    expect(nft.owner.get().toBase58()).toBe(owner.publicKey.toBase58());
    console.log("Updating...");
    const version = NFTparams.unpack(nft.data.get()).version;
    const metadataParams = new MetadataParams();
    metadataParams.data[0] = Field(2);
    const proof = await MetadataUpdate.check(Field(2));
    const tx = await Mina.transaction({ sender: owner.publicKey }, async () => {
      await zkTrusted.update(
        {
          address: nftPublicKey,
          metadataParams,
        },
        proof
      );
    });
    tx.sign([owner.privateKey]);
    await tx.prove();
    await tx.send();

    console.log("Wallet balance is", await accountBalanceMina(wallet));
    expect(nft.metadataParams.get().data[0].toBigInt()).toBe(BigInt(2));
  });

  it(`should update NFT`, async () => {
    expect(nft.owner.get().toBase58()).toBe(owner.publicKey.toBase58());
    console.log("Updating...");
    const version = NFTparams.unpack(nft.data.get()).version;
    const metadataParams = new MetadataParams();
    metadataParams.data[0] = Field(1);
    const tx = await Mina.transaction({ sender: owner.publicKey }, async () => {
      await zkApp.update({
        address: nftPublicKey,
        metadataParams,
      });
    });
    tx.sign([owner.privateKey]);
    await tx.prove();
    await tx.send();

    console.log("Wallet balance is", await accountBalanceMina(wallet));
    expect(nft.metadataParams.get().data[0].toBigInt()).toBe(BigInt(1));
  });

  it(`should sell NFT`, async () => {
    expect(nft.owner.get().toBase58()).toBe(owner.publicKey.toBase58());
    console.log("Wallet balance is", await accountBalanceMina(wallet));

    console.log("Selling...");
    const version = NFTparams.unpack(nft.data.get()).version;
    const tx = await Mina.transaction({ sender: owner.publicKey }, async () => {
      await zkApp.sell({
        address: nftPublicKey,
        price,
      });
    });
    tx.sign([owner.privateKey]);
    await tx.prove();
    await tx.send();
    const data = NFTparams.unpack(nft.data.get());
    expect(data.price.toBigInt()).toBe(price.toBigInt());
    expect(data.version.toBigint()).toBe(version.toBigint() + BigInt(1));
    console.log("Wallet balance is", await accountBalanceMina(wallet));
  });

  it(`should buy NFT`, async () => {
    console.log("Buying...");
    console.log("Wallet balance is", await accountBalanceMina(wallet));
    console.log("Seller balance is", await accountBalanceMina(owner.publicKey));
    console.log("Buyer balance is", await accountBalanceMina(owner2.publicKey));
    const tx = await Mina.transaction(
      { sender: owner2.publicKey },
      async () => {
        await zkApp.buy({
          address: nftPublicKey,
          price,
        });
      }
    );
    tx.sign([owner2.privateKey]);
    await tx.prove();
    await tx.send();
    const data = NFTparams.unpack(nft.data.get());
    expect(data.price.toBigInt()).toBe(BigInt(0));
    expect(nft.owner.get().toBase58()).toBe(owner2.publicKey.toBase58());
    console.log("Wallet balance is", await accountBalanceMina(wallet));
    console.log("Seller balance is", await accountBalanceMina(owner.publicKey));
    console.log("Buyer balance is", await accountBalanceMina(owner2.publicKey));
    owner = owner2;
  });

  it(`should transfer NFT`, async () => {
    expect(nft.owner.get().toBase58()).toBe(owner.publicKey.toBase58());
    console.log("Transferring...");
    const version = NFTparams.unpack(nft.data.get()).version;
    const tx = await Mina.transaction({ sender: owner.publicKey }, async () => {
      await zkApp.transferNFT({
        address: nftPublicKey,
        newOwner: owner3.publicKey,
      });
    });
    tx.sign([owner.privateKey]);
    await tx.prove();
    await tx.send();

    console.log("Wallet balance is", await accountBalanceMina(wallet));
    owner = owner3;
    expect(nft.owner.get().toBase58()).toBe(owner.publicKey.toBase58());
  });

  it(`should sell NFT with KYC`, async () => {
    expect(nft.owner.get().toBase58()).toBe(owner.publicKey.toBase58());
    console.log("Wallet balance is", await accountBalanceMina(wallet));

    console.log("Selling with KYC...");
    const expiry = UInt64.from(Date.now() + 1000 * 60 * 60);
    /*
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
    */
    const fields = [
      ...zkAppPublicKey.toFields(),
      ...nftPublicKey.toFields(),
      kycPrice.value,
      ...owner.publicKey.toFields(),
      expiry.value,
      getNetworkIdHash(),
      Field(1),
    ];
    const signature = Signature.create(oracle.privateKey, fields);
    expect(signature.verify(oracle.publicKey, fields).toBoolean()).toBe(true);
    const version = NFTparams.unpack(nft.data.get()).version;
    const tx = await Mina.transaction({ sender: owner.publicKey }, async () => {
      await zkApp.sellWithKYC(
        {
          address: nftPublicKey,
          price: kycPrice,
        },
        signature,
        expiry
      );
    });
    tx.sign([owner.privateKey]);
    await tx.prove();
    await tx.send();
    const data = NFTparams.unpack(nft.data.get());
    expect(data.price.toBigInt()).toBe(kycPrice.toBigInt());
    expect(data.version.toBigint()).toBe(version.toBigint() + BigInt(1));
    console.log("Wallet balance is", await accountBalanceMina(wallet));
  });

  it(`should buy NFT with KYC`, async () => {
    console.log("Buying with KYC...");
    console.log("Wallet balance is", await accountBalanceMina(wallet));
    console.log("Seller balance is", await accountBalanceMina(owner.publicKey));
    console.log("Buyer balance is", await accountBalanceMina(owner4.publicKey));
    const expiry = UInt64.from(Date.now() + 1000 * 60 * 60);
    const signature = Signature.create(oracle.privateKey, [
      ...zkAppPublicKey.toFields(),
      ...nftPublicKey.toFields(),
      kycPrice.value,
      ...owner4.publicKey.toFields(),
      expiry.value,
      getNetworkIdHash(),
      Field(2),
    ]);

    const tx = await Mina.transaction(
      { sender: owner4.publicKey },
      async () => {
        await zkApp.buyWithKYC(
          {
            address: nftPublicKey,
            price: kycPrice,
          },
          signature,
          expiry
        );
      }
    );
    tx.sign([owner4.privateKey]);
    await tx.prove();
    await tx.send();
    const data = NFTparams.unpack(nft.data.get());
    expect(data.price.toBigInt()).toBe(BigInt(0));
    expect(nft.owner.get().toBase58()).toBe(owner4.publicKey.toBase58());
    console.log("Wallet balance is", await accountBalanceMina(wallet));
    console.log("Seller balance is", await accountBalanceMina(owner.publicKey));
    console.log("Buyer balance is", await accountBalanceMina(owner4.publicKey));
    owner = owner4;
  });
});
