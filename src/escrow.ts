export { MinaNFTEscrow };
import {
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  fetchAccount,
  Signature,
  UInt64,
} from "o1js";
import { MinaNFT } from "./minanft";
import { Escrow, EscrowDeposit } from "./plugins/escrow";
import { EscrowTransfer } from "./contract/escrow";

/**
 * interface for MinaNFTBadge constructor
 * @param name Name of the Badge issuer
 * @param owner Name of the Badge owner
 * @param verifiedKey Key of the Badge that is verified (like "twitter")
 * @param verifiedKind Kind of the Badge that is verified (like "string")
 * @param oracle Oracle public key that verifies the Badge
 *
 */

class MinaNFTEscrow {
  address?: PublicKey;

  /**
   * Create MinaNFTEscrow
   * @param address Public key of the deployed NFT zkApp
   */
  constructor(address?: PublicKey) {
    this.address = address;
  }

  public async deploy(
    deployer: PrivateKey
  ): Promise<Mina.TransactionId | undefined> {
    const sender = deployer.toPublicKey();
    const zkAppPrivateKey = PrivateKey.random();
    const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    await MinaNFT.compileEscrow();
    console.log(
      `deploying the Escrow contract to an address ${zkAppPublicKey.toBase58()} using the deployer with public key ${sender.toBase58()}...`
    );
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppPublicKey });

    const zkApp = new Escrow(zkAppPublicKey);
    const transaction = await Mina.transaction(
      { sender, fee: await MinaNFT.fee(), memo: "minanft.io" },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkApp.deploy({});
      }
    );
    transaction.sign([deployer, zkAppPrivateKey]);
    const tx = await transaction.send();
    await MinaNFT.transactionInfo(tx, "escrow deploy", false);
    if (tx.isSuccess) {
      this.address = zkAppPublicKey;
      return tx;
    } else return undefined;
  }

  public async deposit(
    data: EscrowTransfer,
    buyer: PrivateKey,
    escrow: PublicKey
  ): Promise<{ tx: Mina.TransactionId; deposited: EscrowDeposit } | undefined> {
    if (this.address === undefined) {
      throw new Error("Escrow not deployed");
    }

    await MinaNFT.compileEscrow();
    const sender = buyer.toPublicKey();
    const zkApp = new Escrow(this.address);
    const signature: Signature = Signature.create(buyer, data.toFields());
    const deposited: EscrowDeposit = { data, signature } as EscrowDeposit;
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: this.address });

    const transaction = await Mina.transaction(
      { sender, fee: await MinaNFT.fee(), memo: "minanft.io" },
      () => {
        zkApp.deposit(deposited, buyer.toPublicKey());
        const senderUpdate = AccountUpdate.create(buyer.toPublicKey());
        senderUpdate.requireSignature();
        senderUpdate.send({ to: escrow, amount: data.price });
      }
    );
    await transaction.prove();
    transaction.sign([buyer]);
    const tx = await transaction.send();
    await MinaNFT.transactionInfo(tx, "deposit", false);
    if (tx.isSuccess) {
      return { tx, deposited };
    } else return undefined;
  }

  public async approveSale(
    data: EscrowTransfer,
    seller: PrivateKey
  ): Promise<{ tx: Mina.TransactionId; deposited: EscrowDeposit } | undefined> {
    if (this.address === undefined) {
      throw new Error("Escrow not deployed");
    }

    await MinaNFT.compileEscrow();
    const sender = seller.toPublicKey();
    const zkApp = new Escrow(this.address);
    const signature: Signature = Signature.create(seller, data.toFields());
    //console.log("signature length", signature.toFields().length);
    const deposited: EscrowDeposit = { data, signature } as EscrowDeposit;
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: this.address });

    const transaction = await Mina.transaction(
      { sender, fee: await MinaNFT.fee(), memo: "minanft.io" },
      () => {
        zkApp.approveSale(deposited, seller.toPublicKey());
      }
    );
    await transaction.prove();
    transaction.sign([seller]);
    const tx = await transaction.send();
    await MinaNFT.transactionInfo(tx, "approve sale", false);
    if (tx.isSuccess) {
      return { tx, deposited };
    } else return undefined;
  }

  public async transfer(
    data: EscrowTransfer,
    escrow: PrivateKey,
    sellerDeposited: EscrowDeposit,
    buyerDeposited: EscrowDeposit,
    nft: PublicKey,
    seller: PublicKey,
    buyer: PublicKey
  ): Promise<Mina.TransactionId | undefined> {
    if (this.address === undefined) {
      throw new Error("Escrow not deployed");
    }

    await MinaNFT.compileEscrow();
    const sender = escrow.toPublicKey();
    const zkApp = new Escrow(this.address);
    const signature: Signature = Signature.create(escrow, data.toFields());
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: this.address });

    /*
      @method transfer(
        nft: PublicKey,
        data: EscrowTransfer,
        signature1: Signature,
        signature2: Signature,
        signature3: Signature,
        escrow1: PublicKey,
        escrow2: PublicKey,
        escrow3: PublicKey,
        amount: UInt64,
        seller: PublicKey,
        buyer: PublicKey
      ) {
    */

    const transaction = await Mina.transaction(
      { sender, fee: await MinaNFT.fee(), memo: "minanft.io" },
      () => {
        zkApp.transfer(
          nft,
          data,
          sellerDeposited.signature,
          buyerDeposited.signature,
          signature,
          seller,
          buyer,
          escrow.toPublicKey(),
          data.price,
          seller,
          buyer
        );
        const senderUpdate = AccountUpdate.create(escrow.toPublicKey());
        senderUpdate.requireSignature();
        senderUpdate.send({ to: seller, amount: data.price });
      }
    );
    await transaction.prove();
    transaction.sign([escrow]);
    const tx = await transaction.send();
    await MinaNFT.transactionInfo(tx, "transfer", false);
    if (tx.isSuccess) {
      return tx;
    } else return undefined;
  }
}
