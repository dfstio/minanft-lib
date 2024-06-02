import { describe, expect, it } from "@jest/globals";
import {
  PrivateKey,
  PublicKey,
  Mina,
  VerificationKey,
  UInt64,
  UInt32,
  Cache,
  AccountUpdate,
  Field,
  Encoding,
  Signature,
} from "o1js";
import {
  NameContractV2,
  NFTContractV2,
  NFTparams,
  wallet,
  MetadataParams,
} from "../../src/contract-v2/nft";
import {
  accountBalanceMina,
  getNetworkIdHash,
  initBlockchain,
} from "../../src/mina";

describe("Contract V2", () => {
  let verificationKey: VerificationKey;
  let owner: {
    publicKey: PublicKey;
    privateKey: PrivateKey;
  };
  let owner1: {
    publicKey: PublicKey;
    privateKey: PrivateKey;
  };
  let owner2: {
    publicKey: PublicKey;
    privateKey: PrivateKey;
  };
  let owner3: {
    publicKey: PublicKey;
    privateKey: PrivateKey;
  };
  let owner4: {
    publicKey: PublicKey;
    privateKey: PrivateKey;
  };
  let deployer: PrivateKey;
  let sender: PublicKey;

  const zkAppPrivateKey = PrivateKey.random();
  const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
  const zkApp = new NameContractV2(zkAppPublicKey);
  const tokenId = zkApp.deriveTokenId();
  const nftPrivateKey = PrivateKey.random();
  const nftPublicKey = nftPrivateKey.toPublicKey();
  const nft = new NFTContractV2(nftPublicKey, tokenId);
  const price = UInt64.from(100_000_000_000);
  const kycPrice = UInt64.from(200_000_000_000);
  const oracle = PrivateKey.randomKeypair();

  it(`should initialize blockchain`, async () => {
    const { keys } = await initBlockchain("local", 5);
    owner1 = keys[1];
    owner = owner1;
    owner2 = keys[2];
    owner3 = keys[3];
    owner4 = keys[4];
    deployer = keys[0].privateKey;
    sender = deployer.toPublicKey();
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
    verificationKey = (await NFTContractV2.compile({ cache })).verificationKey;
    return;
    await NameContractV2.compile({ cache });
    console.timeEnd("compiled NameContract");

    const methods = [
      {
        name: "NFTContractV2",
        result: await NFTContractV2.analyzeMethods(),
      },
      { name: "NameContract", result: await NameContractV2.analyzeMethods() },
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
      for (const method in contract.result) {
        console.log(method, `rows:`, (contract.result as any)[method].rows);
      }
    }
  });
  return;

  it(`should deploy contracts`, async () => {
    console.log("Deploying contracts...");
    const tx = await Mina.transaction({ sender }, async () => {
      AccountUpdate.fundNewAccount(sender);
      await zkApp.deploy({});
      zkApp.priceLimit.set(UInt64.from(500_000_000_000));
      zkApp.oracle.set(oracle.publicKey);
      zkApp.verificationKeyHash.set(verificationKey.hash);
    });

    tx.sign([zkAppPrivateKey, deployer]);
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
    const fee = UInt64.from(10_000_000_000);
    const name = Encoding.stringToFields("digital")[0];
    const feeMaster = wallet;
    const signature = getMintSignature({
      oracle: oracle.privateKey,
      zkAppPublicKey,
      fee,
      feeMaster,
      name,
      owner: owner.publicKey,
    });
    const tx = await Mina.transaction({ sender: owner.publicKey }, async () => {
      AccountUpdate.fundNewAccount(owner.publicKey);
      await zkApp.mint({
        name,
        address: nftPublicKey,
        metadataParams: MetadataParams.empty(),
        verificationKey,
        fee,
        feeMaster,
        signature,
      });
    });
    tx.sign([nftPrivateKey, owner.privateKey]);
    await tx.prove();
    await tx.send();
    console.timeEnd("minted NFT");
  });

  it(`should update NFT`, async () => {
    expect(nft.owner.get().toBase58()).toBe(owner.publicKey.toBase58());
    console.log("Updating...");
    const version = NFTparams.unpack(nft.data.get()).version;
    const metadataParams = MetadataParams.empty();
    metadataParams.metadata.data = Field(1);
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
    expect(nft.metadataParams.get().metadata.data.toBigInt()).toBe(BigInt(1));
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

function getMintSignature(params: {
  oracle: PrivateKey;
  zkAppPublicKey: PublicKey;
  fee: UInt64;
  feeMaster: PublicKey;
  name: Field;
  owner: PublicKey;
}) {
  const { oracle, zkAppPublicKey, fee, feeMaster, owner, name } = params;
  return Signature.create(oracle, [
    ...owner.toFields(),
    name,
    fee.value,
    ...feeMaster.toFields(),
    ...zkAppPublicKey.toFields(),
    getNetworkIdHash(),
  ]);
}
