export { MinaNFTNameService };
import {
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  fetchAccount,
  Field,
  Signature,
  Account,
} from "o1js";
import { MinaNFT } from "./minanft";
import { MinaNFTNameServiceContract, NFTMintData } from "./contract/names";

class MinaNFTNameService {
  address?: PublicKey;
  oraclePrivateKey?: PrivateKey;
  tokenId?: Field;

  /**
   * Create MinaNFTNameService object
   * @param address Public key of the deployed Names Service
   */
  constructor(value: { address?: PublicKey; oraclePrivateKey?: PrivateKey }) {
    this.address = value.address;
    this.oraclePrivateKey = value.oraclePrivateKey;
  }

  public async deploy(
    deployer: PrivateKey,
    privateKey: PrivateKey | undefined = undefined,
    nonce?: number
  ): Promise<Mina.TransactionId | undefined> {
    const sender = deployer.toPublicKey();

    if (this.oraclePrivateKey === undefined)
      throw new Error("Oracle private key is not set");
    const oracle = this.oraclePrivateKey.toPublicKey();
    const zkAppPrivateKey = privateKey ?? PrivateKey.random();
    const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    await MinaNFT.compile();
    console.log(
      `deploying the MinaNFTNameServiceContract to an address ${zkAppPublicKey.toBase58()} using the deployer with public key ${sender.toBase58()}...`
    );

    const zkApp = new MinaNFTNameServiceContract(zkAppPublicKey);
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppPublicKey });
    const deployNonce = nonce ?? Number(Account(sender).nonce.get().toBigint());
    const hasAccount = Mina.hasAccount(zkAppPublicKey);

    const transaction = await Mina.transaction(
      {
        sender,
        fee: await MinaNFT.fee(),
        memo: "minanft.io",
        nonce: deployNonce,
      },
      () => {
        if (!hasAccount) AccountUpdate.fundNewAccount(sender);
        zkApp.deploy({});
        zkApp.oracle.set(oracle);
        zkApp.account.zkappUri.set("https://minanft.io");
        zkApp.account.tokenSymbol.set("NFT");
      }
    );
    transaction.sign([deployer, zkAppPrivateKey]);
    const tx = await transaction.send();
    await MinaNFT.transactionInfo(tx, "name service deploy", false);
    if (tx.isSuccess) {
      this.address = zkAppPublicKey;
      this.tokenId = zkApp.token.id;
      return tx;
    } else return undefined;
  }

  public async issueNameSignature(
    nft: NFTMintData,
    verificationKeyHash: Field
  ): Promise<Signature> {
    if (nft.address === undefined) throw new Error("NFT address is not set");
    if (nft.name.toJSON() !== nft.initialState[0].toJSON())
      throw new Error("Name mismatch");
    if (this.address === undefined)
      throw new Error("Names service address is not set");
    if (this.oraclePrivateKey === undefined)
      throw new Error("Oracle is not set");

    // TODO: change to api call
    const signature: Signature = Signature.create(this.oraclePrivateKey, [
      ...nft.address.toFields(),
      nft.name,
      verificationKeyHash,
      ...this.address.toFields(),
    ]);
    return signature;
  }
}
