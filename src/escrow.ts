export { MinaNFTEscrow, EscrowTransferData };
import {
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  fetchAccount,
  Signature,
  Field,
  Account,
} from "o1js";
import { MinaNFT } from "./minanft";
import { Escrow, EscrowDeposit } from "./plugins/escrow";
import { EscrowTransfer } from "./contract/escrow";
import { sleep } from "./mina";

interface EscrowTransferData {
  data: EscrowTransfer;
  escrow: PrivateKey;
  sellerDeposited: EscrowDeposit;
  buyerDeposited: EscrowDeposit;
  nft: PublicKey;
  nameService: PublicKey;
  tokenId: Field;
  seller: PublicKey;
  buyer: PublicKey;
  isKYCpassed: boolean;
}

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
    deployer: PrivateKey,
    privateKey: PrivateKey | undefined = undefined
  ): Promise<Mina.PendingTransaction | undefined> {
    const sender = deployer.toPublicKey();
    const zkAppPrivateKey = privateKey ?? PrivateKey.random();
    const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    await MinaNFT.compileEscrow();
    console.log(
      `deploying the Escrow contract to an address ${zkAppPublicKey.toBase58()} using the deployer with public key ${sender.toBase58()}...`
    );
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppPublicKey });
    const hasAccount = Mina.hasAccount(zkAppPublicKey);

    const zkApp = new Escrow(zkAppPublicKey);
    const transaction = await Mina.transaction(
      { sender, fee: await MinaNFT.fee(), memo: "minanft.io" },
      async () => {
        if (!hasAccount) AccountUpdate.fundNewAccount(sender);
        await zkApp.deploy({});
        zkApp.account.tokenSymbol.set("ESCROW");
        zkApp.account.zkappUri.set("https://minanft.io/@escrow");
      }
    );
    transaction.sign([deployer, zkAppPrivateKey]);
    const tx = await transaction.send();
    await MinaNFT.transactionInfo(tx, "escrow deploy", false);
    if (tx.status === "pending") {
      this.address = zkAppPublicKey;
      return tx;
    } else return undefined;
  }

  public async deposit(
    data: EscrowTransfer,
    buyer: PrivateKey,
    escrow: PublicKey
  ): Promise<
    { tx: Mina.PendingTransaction; deposited: EscrowDeposit } | undefined
  > {
    if (this.address === undefined) {
      throw new Error("Escrow not deployed");
    }

    await MinaNFT.compileEscrow();
    const sender = buyer.toPublicKey();
    const zkApp = new Escrow(this.address);
    const signature: Signature = Signature.create(
      buyer,
      EscrowTransfer.toFields(data)
    );
    const deposited: EscrowDeposit = { data, signature } as EscrowDeposit;
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: this.address });

    const transaction = await Mina.transaction(
      { sender, fee: await MinaNFT.fee(), memo: "minanft.io" },
      async () => {
        await zkApp.deposit(deposited, buyer.toPublicKey());
        const senderUpdate = AccountUpdate.create(buyer.toPublicKey());
        senderUpdate.requireSignature();
        senderUpdate.send({ to: escrow, amount: data.price });
      }
    );
    await sleep(100); // alow GC to run
    await transaction.prove();
    transaction.sign([buyer]);
    const tx = await transaction.send();
    await MinaNFT.transactionInfo(tx, "deposit", false);
    if (tx.status === "pending") {
      return { tx, deposited };
    } else return undefined;
  }

  public async approveSale(
    data: EscrowTransfer,
    seller: PrivateKey
  ): Promise<
    { tx: Mina.PendingTransaction; deposited: EscrowDeposit } | undefined
  > {
    if (this.address === undefined) {
      throw new Error("Escrow not deployed");
    }

    await MinaNFT.compileEscrow();
    const sender = seller.toPublicKey();
    const zkApp = new Escrow(this.address);
    const signature: Signature = Signature.create(
      seller,
      EscrowTransfer.toFields(data)
    );
    //console.log("signature length", signature.toFields().length);
    const deposited: EscrowDeposit = { data, signature } as EscrowDeposit;
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: this.address });

    const transaction = await Mina.transaction(
      { sender, fee: await MinaNFT.fee(), memo: "minanft.io" },
      async () => {
        await zkApp.approveSale(deposited, seller.toPublicKey());
      }
    );
    await sleep(100); // alow GC to run
    await transaction.prove();
    transaction.sign([seller]);
    const tx = await transaction.send();
    await MinaNFT.transactionInfo(tx, "approve sale", false);
    if (tx.status === "pending") {
      return { tx, deposited };
    } else return undefined;
  }

  public async transfer(
    transferData: EscrowTransferData
  ): Promise<Mina.PendingTransaction | undefined> {
    const {
      data,
      escrow,
      sellerDeposited,
      buyerDeposited,
      nft,
      nameService,
      tokenId,
      seller,
      buyer,
      isKYCpassed,
    } = transferData;

    if (this.address === undefined) {
      throw new Error("Escrow not deployed");
    }
    if (isKYCpassed === false) {
      throw new Error(
        "KYC not passed. It is obligation of the escrow agent to check the KYC status of the buyer and the seller."
      );
    }

    await MinaNFT.compileEscrow();
    const sender = escrow.toPublicKey();
    const zkApp = new Escrow(this.address);
    const signature: Signature = Signature.create(
      escrow,
      EscrowTransfer.toFields(data)
    );
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: this.address });
    await fetchAccount({ publicKey: nameService });
    await fetchAccount({ publicKey: nft, tokenId });
    const hasAccount = Mina.hasAccount(nft, tokenId);
    const account = Mina.getAccount(nft, tokenId);
    const balance = Mina.getBalance(nft, tokenId);
    console.log(
      `transfer checks result:`,
      hasAccount,
      tokenId.toJSON(),
      account.balance.toString(),
      balance.toString()
    );
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
      async () => {
        await zkApp.transfer(
          nft,
          nameService,
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
    await sleep(100); // alow GC to run
    await transaction.prove();
    transaction.sign([escrow]);
    const tx = await transaction.send();
    await MinaNFT.transactionInfo(tx, "transfer", false);
    if (tx.status === "pending") {
      return tx;
    } else return undefined;
  }
}
