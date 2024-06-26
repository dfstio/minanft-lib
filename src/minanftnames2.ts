export { MinaNFTNameServiceV2 };
import {
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  Field,
  Signature,
  Account,
  VerificationKey,
  UInt64,
  UInt32,
  fetchLastBlock,
} from "o1js";
import { MinaNFT } from "./minanft";
import {
  NFTContractV2,
  NameContractV2,
  KYCSignatureData,
  MintSignatureData,
  networkIdHash,
} from "./contract-v2/nft";
import { fetchMinaAccount } from "./fetch";
import { blockchain } from "./networks";
import { calculateNetworkIdHash, sleep } from "./mina";

class MinaNFTNameServiceV2 {
  address?: PublicKey;
  oraclePrivateKey?: PrivateKey;
  priceLimit?: UInt64;
  tokenId?: Field;

  /**
   * Create MinaNFTNameService object
   * @param value Object with address and oraclePrivateKey fields
   * @param value.address Public key of the deployed Names Service
   * @param value.oraclePrivateKey Private key of the oracle
   */
  constructor(value: {
    address?: PublicKey;
    oraclePrivateKey?: PrivateKey;
    priceLimit?: UInt64;
  }) {
    this.address = value.address;
    this.oraclePrivateKey = value.oraclePrivateKey;
    this.priceLimit = value.priceLimit;
  }

  public async deploy(params: {
    deployer: PrivateKey;
    privateKey?: PrivateKey;
    nonce?: number;
  }): Promise<Mina.PendingTransaction | undefined> {
    const { deployer, privateKey, nonce } = params;
    const sender = deployer.toPublicKey();

    if (this.oraclePrivateKey === undefined)
      throw new Error("Oracle private key is not set");
    if (this.priceLimit === undefined)
      throw new Error("Price limit is not set");
    const oracle = this.oraclePrivateKey.toPublicKey();
    const zkAppPrivateKey = privateKey ?? PrivateKey.random();
    const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    console.log(
      `deploying the NameContractV2 to an address ${zkAppPublicKey.toBase58()} using the deployer with public key ${sender.toBase58()}...`
    );

    console.time(`compiled`);
    const verificationKey = (await NFTContractV2.compile()).verificationKey;
    const vk = (await NameContractV2.compile()).verificationKey;
    console.timeEnd(`compiled`);
    console.log(`vk hash: ${vk.hash.toJSON()}`);
    const zkApp = new NameContractV2(zkAppPublicKey);
    await fetchMinaAccount({ publicKey: sender });
    const deployNonce =
      nonce ?? Number(Mina.getAccount(sender).nonce.toBigint());
    const hasAccount = Mina.hasAccount(zkAppPublicKey);

    const transaction = await Mina.transaction(
      {
        sender,
        fee: await MinaNFT.fee(),
        memo: "deploy minanft.io",
        nonce: deployNonce,
      },
      async () => {
        if (!hasAccount) AccountUpdate.fundNewAccount(sender);
        await zkApp.deploy({});
        zkApp.oracle.set(oracle);
        zkApp.priceLimit.set(this.priceLimit!);
        zkApp.account.zkappUri.set("https://minanft.io");
        zkApp.account.tokenSymbol.set("NFT");
        zkApp.verificationKeyHash.set(verificationKey.hash);
      }
    );
    transaction.sign([deployer, zkAppPrivateKey]);
    const tx = await transaction.send();
    await MinaNFT.transactionInfo(tx, "name service deploy", false);
    if (tx.status === "pending") {
      this.address = zkAppPublicKey;
      this.tokenId = zkApp.deriveTokenId();
      return tx;
    } else return undefined;
  }

  public async upgrade(params: {
    deployer: PrivateKey;
    privateKey: PrivateKey;
    nonce?: number;
  }): Promise<
    | {
        tx1included: Mina.IncludedTransaction;
        tx2included: Mina.IncludedTransaction;
      }
    | undefined
  > {
    const { deployer, privateKey, nonce } = params;
    const sender = deployer.toPublicKey();

    if (this.address === undefined) throw new Error("Address is not set");
    const zkAppPrivateKey = privateKey;
    const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    if (this.address.toBase58() !== zkAppPublicKey.toBase58())
      throw new Error("Address mismatch");
    console.time(`compiled`);
    const verificationKey = (await NFTContractV2.compile()).verificationKey;
    const vk = (await NameContractV2.compile()).verificationKey;
    console.timeEnd(`compiled`);
    console.log(`vk hash: ${vk.hash.toJSON()}`);
    const zkApp = new NameContractV2(zkAppPublicKey);
    console.log(
      `upgrading the NameContractV2 on address ${zkAppPublicKey.toBase58()} using the deployer with public key ${sender.toBase58()}...`
    );

    await fetchMinaAccount({ publicKey: sender });
    await fetchMinaAccount({ publicKey: zkAppPublicKey });
    const deployNonce =
      nonce ?? Number(Mina.getAccount(sender).nonce.toBigint());
    const hasAccount = Mina.hasAccount(zkAppPublicKey);
    if (!hasAccount) throw new Error("Account does not exist");

    const transaction = await Mina.transaction(
      {
        sender,
        fee: await MinaNFT.fee(),
        memo: "upgrade minanft.io 1/2",
        nonce: deployNonce,
      },
      async () => {
        const update = AccountUpdate.createSigned(zkAppPublicKey);
        update.account.verificationKey.set(vk);
      }
    );
    transaction.sign([deployer, zkAppPrivateKey]);
    const tx1 = await transaction.send();
    await MinaNFT.transactionInfo(tx1, "name service upgrade 1/2", false);
    if (tx1.status === "pending") {
      this.address = zkAppPublicKey;
      this.tokenId = zkApp.deriveTokenId();
    } else return undefined;
    const tx1included = await tx1.wait({ maxAttempts: 1000 });
    await sleep(10000);
    await fetchMinaAccount({ publicKey: sender });
    await fetchMinaAccount({ publicKey: zkAppPublicKey });

    const transaction2 = await Mina.transaction(
      {
        sender,
        fee: await MinaNFT.fee(),
        memo: "upgrade minanft.io 2/2",
        nonce: deployNonce,
      },
      async () => {
        await zkApp.setVerificationKeyHash(verificationKey.hash);
      }
    );
    transaction2.sign([deployer, zkAppPrivateKey]);
    await transaction2.prove();
    const tx2 = await transaction2.send();
    await MinaNFT.transactionInfo(tx2, "name service upgrade 2/2", false);
    const tx2included = await tx2.wait({ maxAttempts: 1000 });
    return { tx1included, tx2included };
  }

  public async issueNameSignature(params: {
    fee: UInt64;
    feeMaster: PublicKey;
    name: Field;
    owner: PublicKey;
    chain: blockchain;
    expiryInBlocks: number;
  }): Promise<{ signature: Signature; expiry: UInt32 }> {
    const { fee, feeMaster, owner, name, chain, expiryInBlocks } = params;
    if (this.address === undefined)
      throw new Error("Names service address is not set");
    if (this.oraclePrivateKey === undefined)
      throw new Error("Oracle is not set");
    const networkId = Mina.getNetworkId();
    if (chain === "mainnet" && networkId !== "mainnet")
      throw new Error("Network mismatch at issueNameSignature");
    const lastBlock = await fetchLastBlock();
    console.log(
      `${chain} globalSlotSinceGenesis:`,
      lastBlock.globalSlotSinceGenesis.toBigint()
    );
    const expiry = lastBlock.globalSlotSinceGenesis.add(
      UInt32.from(expiryInBlocks)
    );
    /*
    const { oracle, contract, address, fee, feeMaster, owner, name, expiry } =
    params;
    */
    return {
      signature: Signature.create(
        this.oraclePrivateKey,
        MintSignatureData.toFields(
          new MintSignatureData({
            fee,
            feeMaster,
            name,
            owner,
            contract: this.address,
            networkIdHash: networkIdHash(),
            expiry,
          })
        )
      ),
      expiry,
    };
  }
}
