// https://github.com/o1-labs/o1js/issues/1607

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
  fetchAccount,
  Transaction,
  Lightnet,
} from "o1js";
import { initBlockchain, sleep } from "../src/mina";
import { blockchain } from "../src/networks";
import { DEPLOYER, GASTANKS } from "../env.json";
import fs from "fs/promises";

const chain: blockchain = "lighnet" as blockchain;

const useLocalBlockchain = chain === "local";
const useLighnet = chain === "lighnet";
const isZeko = chain === "zeko";
type keypair = { publicKey: PublicKey; privateKey: PrivateKey };
const MINT_FEE = 10_000n;
const SELL_FEE = 1_000n;
const SELL_WITH_KYC_FEE = 50_000n;
const TRANSFER_FEE = 1_000n;
const UPDATE_FEE = 1_000n;
const fee = 10_000_000;
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
    //const timestamp = this.network.timestamp.getAndRequireEquals();
    //timestamp.assertLessThan(expiry);
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
    //const timestamp = this.network.timestamp.getAndRequireEquals();
    //timestamp.assertLessThan(expiry);
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
  let deployer: keypair;
  let owner: keypair;
  let owner1: keypair;
  let owner2: keypair;
  let owner3: keypair;
  let owner4: keypair;
  let sender: PublicKey;
  let verificationKey: VerificationKey;
  const zkAppPrivateKey = PrivateKey.random();
  const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
  const trusted = PrivateKey.randomKeypair();
  const zkApp = new NameContract(zkAppPublicKey);
  const zkTrusted = new TrustedUpdate(trusted.publicKey);
  let tokenId: Field;
  const nftPrivateKey = PrivateKey.random();
  const nftPublicKey = nftPrivateKey.toPublicKey();
  let nft: NFTContract;
  const price = UInt64.from(100_000);
  const kycPrice = UInt64.from(200_000);
  const oracle = PrivateKey.randomKeypair();

  it(`should initialize blockchain`, async () => {
    console.log("network:", chain);
    console.log("Local blockchain:", useLocalBlockchain);
    console.log("Lightnet:", useLighnet);
    if (useLocalBlockchain) {
      const local = Mina.LocalBlockchain({
        proofsEnabled: true,
      });
      Mina.setActiveInstance(local);
      deployer = local.testAccounts[0];
      owner1 = local.testAccounts[1];
      owner2 = local.testAccounts[2];
      owner3 = local.testAccounts[3];
      owner4 = local.testAccounts[4];
    } else if (useLighnet) {
      const network = Mina.Network({
        mina: "http://localhost:8080/graphql",
        archive: "http://localhost:8282",
        lightnetAccountManager: "http://localhost:8181",
      });
      Mina.setActiveInstance(network);

      deployer = await Lightnet.acquireKeyPair();
      owner1 = await Lightnet.acquireKeyPair();
      owner2 = await Lightnet.acquireKeyPair();
      owner3 = await Lightnet.acquireKeyPair();
      owner4 = await Lightnet.acquireKeyPair();
      console.log(
        "Deployer balance is",
        await accountBalanceMina(deployer.publicKey)
      );
    } else {
      const instance = await initBlockchain(chain);
      console.log("Endpoint:", instance.network.mina);
      deployer = key(DEPLOYER);
      owner1 = key(GASTANKS[0]);
      owner2 = key(GASTANKS[1]);
      owner3 = key(GASTANKS[2]);
      owner4 = key(GASTANKS[3]);
    }

    owner = owner1;
    sender = deployer.publicKey;
    console.log("Sender balance is", await accountBalanceMina(sender));
  });
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
    console.log(
      "Deploying contracts to ",
      zkAppPublicKey.toBase58(),
      trusted.publicKey.toBase58(),
      nftPublicKey.toBase58()
    );

    await fetchAccount({ publicKey: sender });
    console.log(
      "Sender balance before deploy is",
      await accountBalanceMina(sender)
    );
    const tx = await Mina.transaction(
      { sender, fee, memo: "MinaNFT deploy" },
      async () => {
        AccountUpdate.fundNewAccount(sender, 2);
        await zkApp.deploy({});
        zkApp.priceLimit.set(UInt64.from(100_000));
        zkApp.oracle.set(oracle.publicKey);

        await zkTrusted.deploy({});
        zkTrusted.contract.set(zkAppPublicKey);
      }
    );

    tx.sign([zkAppPrivateKey, trusted.privateKey, deployer.privateKey]);
    await sendTx(tx, "deploy");
    tokenId = zkApp.deriveTokenId();
    nft = new NFTContract(nftPublicKey, tokenId);
    await fetchAccount({ publicKey: sender });
    console.log(
      "Sender balance after deploy is",
      await accountBalanceMina(sender)
    );
    await fetchAccount({ publicKey: zkAppPublicKey });
    const priceLimit = zkApp.priceLimit.get();
    console.log("Price limit is", priceLimit.toBigInt());
    if (priceLimit.toBigInt() > 0) {
      console.log("Price limit is set");
      console.log(
        zkAppPublicKey.toBase58(),
        trusted.publicKey.toBase58(),
        nftPublicKey.toBase58(),
        sender.toBase58(),
        wallet.toBase58()
      );
    }
  });

  it(`should create wallet account`, async () => {
    if (
      (useLocalBlockchain || useLighnet) &&
      0 === (await accountBalanceMina(wallet))
    ) {
      const tx = await Mina.transaction(
        { sender, fee, memo: "MinaNFT wallet" },
        async () => {
          const senderUpdate = AccountUpdate.createSigned(sender);
          senderUpdate.balance.subInPlace(1_000_000_000);
          senderUpdate.send({ to: wallet, amount: 2_000_000_000 });
        }
      );
      tx.sign([deployer.privateKey]);
      await sendTx(tx, "wallet");
    }
    await fetchAccount({ publicKey: wallet });
    oldBalance = await accountBalanceMina(wallet);
    console.log("Wallet balance is", oldBalance);
  });

  it(`should mint NFT`, async () => {
    console.log("Minting NFT...");
    console.time("minted NFT");
    await fetchAccount({ publicKey: zkAppPublicKey });
    await fetchAccount({ publicKey: owner.publicKey });
    await fetchAccount({ publicKey: wallet });

    const tx = await Mina.transaction(
      { sender: owner.publicKey, fee, memo: "MinaNFT mint" },
      async () => {
        AccountUpdate.fundNewAccount(owner.publicKey);
        await zkApp.mint({
          name: Field(1),
          address: nftPublicKey,
          metadataParams: new MetadataParams(),
          verificationKey,
        });
      }
    );
    tx.sign([nftPrivateKey, owner.privateKey]);
    await tx.prove();
    await sendTx(tx, "mint");
    console.timeEnd("minted NFT");
  });

  it(`should not throw Payload Too Large error`, async () => {
    await fetchAccount({ publicKey: nftPublicKey, tokenId });
    expect(nft.owner.get().toBase58()).toBe(owner.publicKey.toBase58());
    console.log("Updating using TrustedUpdate...");
    const version = NFTparams.unpack(nft.data.get()).version;
    const metadataParams = new MetadataParams();
    metadataParams.data[0] = Field(2);
    const proof = await MetadataUpdate.check(Field(2));
    await fetchAccount({ publicKey: zkAppPublicKey });
    await fetchAccount({ publicKey: owner.publicKey });
    await fetchAccount({ publicKey: nftPublicKey, tokenId });
    await fetchAccount({ publicKey: trusted.publicKey });
    await fetchAccount({ publicKey: wallet });

    const tx = await Mina.transaction(
      { sender: owner.publicKey, fee, memo: "MinaNFT trusted update" },
      async () => {
        await zkTrusted.update(
          {
            address: nftPublicKey,
            metadataParams,
          },
          proof
        );
      }
    );
    await tx.prove();
    tx.sign([owner.privateKey]);
    const data = JSON.stringify(
      {
        tx: tx.toJSON(),
        pretty: tx.toPretty(),
      },
      null,
      2
    );
    await fs.writeFile("./json/payload-issue-lightnet.json", data);
    await sendTx(tx, "trusted update");

    await fetchAccount({ publicKey: nftPublicKey, tokenId });
    await fetchAccount({ publicKey: wallet });
    await walletBalance();
    expect(nft.metadataParams.get().data[0].toBigInt()).toBe(BigInt(2));
  });
});

let oldBalance = 0;
async function walletBalance() {
  const balance = await accountBalanceMina(wallet);
  console.log("Wallet balance is", balance, "changed by", balance - oldBalance);
  oldBalance = balance;
}

function key(privateKeyStr: string): keypair {
  const privateKey = PrivateKey.fromBase58(privateKeyStr);
  return { publicKey: privateKey.toPublicKey(), privateKey };
}

async function accountBalance(address: PublicKey): Promise<UInt64> {
  try {
    await fetchAccount({ publicKey: address });
    if (Mina.hasAccount(address)) return Mina.getBalance(address);
    else return UInt64.from(0);
  } catch (error: any) {
    //console.error(error);
    return UInt64.from(0);
  }
}

async function accountBalanceMina(address: PublicKey): Promise<number> {
  return Number((await accountBalance(address)).toBigInt()) / 1e9;
}

async function sendTx(tx: Transaction, description?: string) {
  let txSent: Mina.PendingTransaction | undefined;
  try {
    txSent = await tx.send();
    //console.log("txSent", txSent);
  } catch (error) {
    console.log("Error sending tx", error);
    txSent = undefined;
  }
  if (txSent === undefined) {
    console.log("txSent is undefined");
    await sleep(10000);
    return;
  }
  if (txSent.errors.length > 0) {
    console.error(
      `${description ?? ""} tx error: hash: ${txSent.hash} status: ${
        txSent.status
      }  errors: ${txSent.errors}`
    );
    throw new Error("Transaction failed");
  }
  console.log(
    `${description ?? ""} tx sent: hash: ${txSent.hash} status: ${
      txSent.status
    }`
  );

  if (isZeko) await sleep(5000);
  else {
    try {
      const txIncluded = await txSent.wait();
      console.log(
        `${description ?? ""} tx included into block: hash: ${
          txIncluded.hash
        } status: ${txIncluded.status}`
      );
    } catch (error) {
      console.log("Error waiting for tx", error);
    }
    if (!useLocalBlockchain) await sleep(10000);
  }
}
