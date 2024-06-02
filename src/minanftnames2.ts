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
} from "o1js";
import { MinaNFT } from "./minanft";
import { NFTContractV2, NameContractV2 } from "./contract-v2/nft";
import { fetchMinaAccount } from "./fetch";
import { getNetworkIdHash } from "./mina";

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

  public async deploy(
    deployer: PrivateKey,
    privateKey: PrivateKey | undefined = undefined,
    nonce?: number
  ): Promise<Mina.PendingTransaction | undefined> {
    const sender = deployer.toPublicKey();

    if (this.oraclePrivateKey === undefined)
      throw new Error("Oracle private key is not set");
    if (this.priceLimit === undefined)
      throw new Error("Price limit is not set");
    const oracle = this.oraclePrivateKey.toPublicKey();
    const zkAppPrivateKey = privateKey ?? PrivateKey.random();
    const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    console.log(
      `deploying the MinaNFTNameServiceContract to an address ${zkAppPublicKey.toBase58()} using the deployer with public key ${sender.toBase58()}...`
    );

    console.time(`compiled`);
    const verificationKey = (await NFTContractV2.compile()).verificationKey;
    await NameContractV2.compile();
    console.timeEnd(`compiled`);
    const zkApp = new NameContractV2(zkAppPublicKey);
    await fetchMinaAccount({ publicKey: sender });
    const deployNonce =
      nonce ?? Number(Mina.getAccount(sender).nonce.toBigint());
    const hasAccount = Mina.hasAccount(zkAppPublicKey);

    const transaction = await Mina.transaction(
      {
        sender,
        fee: await MinaNFT.fee(),
        memo: "minanft.io",
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

  public async upgrade(
    deployer: PrivateKey,
    privateKey: PrivateKey,
    nonce?: number
  ): Promise<Mina.PendingTransaction | undefined> {
    const sender = deployer.toPublicKey();

    if (this.address === undefined) throw new Error("Address is not set");
    const zkAppPrivateKey = privateKey;
    const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    if (this.address.toBase58() !== zkAppPublicKey.toBase58())
      throw new Error("Address mismatch");
    if (MinaNFT.namesVerificationKey === undefined)
      throw new Error("Compilation error: Verification key is not set");
    const verificationKey: VerificationKey = MinaNFT.namesVerificationKey;
    console.log(
      `upgrading the MinaNFTNameServiceContract on address ${zkAppPublicKey.toBase58()} using the deployer with public key ${sender.toBase58()}...`
    );

    const zkApp = new NameContractV2(zkAppPublicKey);
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
        memo: "minanft.io",
        nonce: deployNonce,
      },
      async () => {
        const update = AccountUpdate.createSigned(zkAppPublicKey);
        update.account.verificationKey.set(verificationKey);
      }
    );
    transaction.sign([deployer, zkAppPrivateKey]);
    const tx = await transaction.send();
    await MinaNFT.transactionInfo(tx, "name service upgrade", false);
    if (tx.status === "pending") {
      this.address = zkAppPublicKey;
      this.tokenId = zkApp.deriveTokenId();
      return tx;
    } else return undefined;
  }

  public async issueNameSignature(params: {
    fee: UInt64;
    feeMaster: PublicKey;
    name: Field;
    owner: PublicKey;
  }): Promise<Signature> {
    const { fee, feeMaster, owner, name } = params;
    if (this.address === undefined)
      throw new Error("Names service address is not set");
    if (this.oraclePrivateKey === undefined)
      throw new Error("Oracle is not set");

    return Signature.create(this.oraclePrivateKey, [
      ...owner.toFields(),
      name,
      fee.value,
      ...feeMaster.toFields(),
      ...this.address.toFields(),
      getNetworkIdHash(),
    ]);
  }
}
