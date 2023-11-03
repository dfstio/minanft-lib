export { MinaNFT, MinaNFTobject };

import {
  Mina,
  PrivateKey,
  PublicKey,
  Field,
  AccountUpdate,
  Encoding,
  verify,
  fetchAccount,
  Poseidon,
  Signature,
  UInt64,
  Types,
} from "o1js";

import { BaseMinaNFT } from "./baseminanft";
import { MinaNFTContract } from "./contract/nft";
import { Metadata, Update } from "./contract/metadata";
import {
  MinaNFTMetadataUpdate,
  MetadataTransition,
  MetadataUpdate,
  MetadataMap,
  MinaNFTMetadataUpdateProof,
} from "./contract/update";
import { EscrowData } from "./contract/escrow";

import { RedactedMinaNFTMapStateProof } from "./plugins/redactedmap";
import { MinaNFTVerifier } from "./plugins/verifier";

import { MINAURL, ARCHIVEURL, MINAEXPLORER, MINAFEE } from "../src/config.json";

const transactionFee = 150_000_000; // TODO: use current market fees

class MinaNFTobject {
  metadata: Map<string, string>; // metadata of file
  root?: Field; // root of Merkle tree with file data

  constructor() {
    this.metadata = new Map<string, string>();
  }
}

class MinaNFT extends BaseMinaNFT {
  /*
  @state(Field) name = State<Field>();
  @state(Metadata) metadata = State<Metadata>();
  @state(Field) storage = State<Field>();
  @state(Field) owner = State<Field>();
  @state(Field) escrow = State<Field>();
  @state(UInt64) version = State<UInt64>();
  */

  name: string;
  storage: string;
  owner: Field;
  escrow: Field;
  version: UInt64;
  isMinted: boolean;
  zkAppPublicKey: PublicKey | undefined;

  private updates: MetadataUpdate[];
  private metadataRoot: Metadata;

  /**
   * Create MinaNFT object
   * @param name Name of NFT
   * @param zkAppPublicKey Public key of the deployed NFT zkApp
   */
  constructor(name: string, zkAppPublicKey: PublicKey | undefined = undefined) {
    super();
    this.name = name;
    this.storage = "";
    this.owner = Field(0);
    this.escrow = Field(0);
    this.version = UInt64.from(0);
    this.isMinted = zkAppPublicKey === undefined ? false : true;
    this.zkAppPublicKey = zkAppPublicKey;
    this.updates = [];
    const metadataMap = new MetadataMap();
    this.metadataRoot = metadataMap.getRoot();
  }

  /**
   * Load metadata from blockchain and IPFS/Arweave
   */
  public async loadMetadata(): Promise<void> {
    if (this.zkAppPublicKey === undefined) {
      throw new Error("zkAppPublicKey is undefined");
      return;
    }
    const zkApp = new MinaNFTContract(this.zkAppPublicKey);
    const account = await fetchAccount({ publicKey: this.zkAppPublicKey });
    if (
      !Mina.hasAccount(this.zkAppPublicKey) ||
      account.account === undefined ||
      account.account.zkapp?.zkappUri === undefined
    ) {
      throw new Error("NFT is not deployed");
      return;
    }
    this.name = MinaNFT.stringFromField(zkApp.name.get());
    this.metadataRoot = zkApp.metadata.get();
    this.storage = account.account.zkapp?.zkappUri;
    this.owner = zkApp.owner.get();
    this.escrow = zkApp.escrow.get();
    this.version = zkApp.version.get();
    //TODO: load metadata from IPFS/Arweave
  }
  /**
   * Initialize Mina o1js library
   * @param local Choose Mina network to use. Default is local network
   */
  public static minaInit(local: boolean = true): void {
    const berkeley = Mina.Network({
      mina: MINAURL,
      archive: ARCHIVEURL,
    });
    const Network = local
      ? Mina.LocalBlockchain({ proofsEnabled: true })
      : berkeley;
    Mina.setActiveInstance(Network);
  }

  /**
   * Get current Mina network fee
   * @returns current Mina network fee
   */
  public static async fee(): Promise<UInt64> {
    //TODO: update after mainnet launch
    return UInt64.fromJSON(MINAFEE);
  }

  /**
   * updates Metadata
   * @param key key to update
   * @param value value to update
   */
  public updateMetadata(key: string, value: Metadata): void {
    if (this.isMinted) {
      const update: MetadataUpdate = this.updateMetadataMap(key, value);
      this.updates.push(update);
    } else this.metadata.set(key, value);
  }

  /**
   * updates Metadata
   * @param key key to update
   * @param value value to update
   */
  public update(key: string, kind: string, value: string): void {
    this.updateMetadata(
      key,
      new Metadata({
        data: MinaNFT.stringToField(value),
        kind: MinaNFT.stringToField(kind),
      })
    );
  }

  /**
   * updates Metadata
   * @param key key to update
   * @param value value to update
   */
  public updateField(key: string, kind: string, value: Field): void {
    this.updateMetadata(
      key,
      new Metadata({
        data: value,
        kind: MinaNFT.stringToField(kind),
      })
    );
  }

  /**
   * Commit updates of the MinaNFT to blockchain
   * Generates recursive proofs for all updates,
   * than verify the proof locally and send the transaction to the blockchain
   *
   * @param deployer Private key of the account that will commit the updates
   */
  public async commit(
    deployer: PrivateKey,
    ownerPrivateKey: PrivateKey,
    escrow: Field | undefined = undefined
  ): Promise<Mina.TransactionId | undefined> {
    if (this.zkAppPublicKey === undefined) {
      console.error("NFT contract is not deployed");
      return undefined;
    }
    const zkAppPublicKey: PublicKey = this.zkAppPublicKey;

    if (this.updates.length === 0) {
      console.error("No updates to commit");
      return undefined;
    }

    if (this.isMinted === false) {
      console.error("NFT is not minted");
      return undefined;
    }

    /*
    const proof: MinaNFTMetadataUpdateProof | undefined =
      await this.generateProof();
    if (proof === undefined) {
      console.error("Proof generation error");
      return undefined;
    }
    */
    if (MinaNFT.updateVerificationKey === undefined) {
      console.error("Update verification key is undefined");
      return undefined;
    }

    //console.log("Creating proofs...");
    console.time("Update proofs created");
    let proofs: MinaNFTMetadataUpdateProof[] = [];
    for (const update of this.updates) {
      let state: MetadataTransition | null = MetadataTransition.create(update);
      let proof: MinaNFTMetadataUpdateProof | null =
        await MinaNFTMetadataUpdate.update(state, update);
      proofs.push(proof);
      state = null;
      proof = null;
    }

    //console.log("Merging proofs...");
    let proof: MinaNFTMetadataUpdateProof | null = proofs[0];
    for (let i = 1; i < proofs.length; i++) {
      let state: MetadataTransition | null = MetadataTransition.merge(
        proof.publicInput,
        proofs[i].publicInput
      );
      let mergedProof: MinaNFTMetadataUpdateProof | null =
        await MinaNFTMetadataUpdate.merge(state, proof, proofs[i]);
      proof = mergedProof;
      state = null;
      mergedProof = null;
    }
    proofs = [];

    const verificationResult: boolean = await verify(
      proof.toJSON(),
      MinaNFT.updateVerificationKey
    );
    console.timeEnd("Update proofs created");
    //console.log("Proof verification result:", verificationResult);
    if (verificationResult === false) {
      throw new Error("Proof verification error");
    }

    const storage = await this.pinToStorage();
    if (storage === undefined) {
      throw new Error("Storage error");
    }
    const storageHash: Field = storage.hash;

    //console.log("Commiting updates to blockchain...");
    const sender = deployer.toPublicKey();
    const zkApp = new MinaNFTContract(zkAppPublicKey);
    await fetchAccount({ publicKey: zkAppPublicKey });
    const version: UInt64 = zkApp.version.get();
    const oldEscrow = zkApp.escrow.get();
    const newVersion: UInt64 = version.add(UInt64.from(1));
    const ownerPublicKey = ownerPrivateKey.toPublicKey();
    //const uri: Types.ZkappUri = Types.ZkappUri.fromJSON(storage.url);

    const update: Update = new Update({
      oldRoot: proof.publicInput.oldRoot,
      newRoot: proof.publicInput.newRoot,
      storage: storageHash,
      verifier: PrivateKey.random().toPublicKey(), //TODO: use real verifier
      version: newVersion,
      name: MinaNFT.stringToField(this.name),
      escrow: escrow ?? oldEscrow,
      owner: Poseidon.hash(ownerPublicKey.toFields()),
    });
    const signature = Signature.create(ownerPrivateKey, update.toFields());

    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppPublicKey });

    //console.log("Sending update...");
    const tx = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io" },
      () => {
        zkApp.update(update, signature, ownerPublicKey, proof!);
      }
    );
    await tx.prove();
    tx.sign([deployer]);
    const sentTx = await tx.send();
    await MinaNFT.transactionInfo(sentTx, "update", false);
    const newRoot = proof!.publicInput.newRoot;
    proof = null;
    if (sentTx.isSuccess) {
      this.metadataRoot = newRoot;
      this.updates = [];
      this.version = newVersion;
      this.storage = storage.url;
      this.escrow = update.escrow;
      return sentTx;
    } else return undefined;
  }

  /*
  private async generateProof(): Promise<
    MinaNFTMetadataUpdateProof | undefined
  > {
    if (MinaNFT.updateVerificationKey === undefined) {
      console.error("Update verification key is undefined");
      return undefined;
    }

    //console.log("Creating proofs...");
    console.time("Update proofs created");
    const proofs: MinaNFTMetadataUpdateProof[] = [];
    for (const update of this.updates) {
      const state = MetadataTransition.create(update);
      const proof = await MinaNFTMetadataUpdate.update(state, update);
      proofs.push(proof);
    }

    //console.log("Merging proofs...");
    let proof: MinaNFTMetadataUpdateProof = proofs[0];
    for (let i = 1; i < proofs.length; i++) {
      const state = MetadataTransition.merge(
        proof.publicInput,
        proofs[i].publicInput
      );
      const mergedProof = await MinaNFTMetadataUpdate.merge(
        state,
        proof,
        proofs[i]
      );
      proof = mergedProof;
    }

    const verificationResult: boolean = await verify(
      proof.toJSON(),
      MinaNFT.updateVerificationKey
    );
    console.timeEnd("Update proofs created");
    //console.log("Proof verification result:", verificationResult);
    if (verificationResult === false) {
      throw new Error("Proof verification error");
      return undefined;
    }
    return proof;
  }
*/
  private async pinToStorage(): Promise<
    { hash: Field; url: string } | undefined
  > {
    //console.log("Pinning to IPFS...");
    // TODO: pin to IPFS
    const ipfs = `https://ipfs.io/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi`;
    const ipfs_fields = Encoding.stringToFields(ipfs);
    return { hash: Poseidon.hash(ipfs_fields), url: ipfs };
  }

  /*

  public async getPrivateJson(): Promise<Object | undefined> {
    if (!this.publicAttributes.get("name") || !this.publicAttributes.get("image"))
      return undefined;
    const publicAttributes: MerkleMap = new MerkleMap();
    Object.keys(this.publicAttributes).map((key) => {
      const value = this.publicAttributes.get(key);
      if (value)
        publicAttributes.set(
          MinaNFT.stringToField(key),
          MinaNFT.stringToField(value)
        );
      else {
        console.error("Map error");
        return undefined;
      }
    });
    const publicMapRoot: string = publicAttributes.getRoot().toJSON();

    const privateAttributes: MerkleMap = new MerkleMap();
    Object.keys(this.privateAttributes).map((key) => {
      const value = this.publicAttributes.get(key);
      if (value)
        privateAttributes.set(
          MinaNFT.stringToField(key),
          MinaNFT.stringToField(value)
        );
      else {
        console.error("Map error");
        return undefined;
      }
    });
    const privateMapRoot: string = privateAttributes.getRoot().toJSON();

    return {
      publicMapRoot,
      privateMapRoot,
      secret: this.secret ? this.secret.toJSON() : "",
      salt: this.salt ? this.salt.toJSON() : "",
      publicAttributes: MinaNFT.mapToJSON(this.publicAttributes),
      privateAttributes: MinaNFT.mapToJSON(this.privateAttributes),
    };
  }
  */

  public static async transactionInfo(
    tx: Mina.TransactionId,
    description: string = "",
    wait: boolean = true
  ): Promise<void> {
    if (tx.isSuccess === false) {
      console.error("Transaction failed");
      return;
    }
    try {
      Mina.getNetworkState();
    } catch (error) {
      // We're on Berkeley
      const hash = tx.hash();
      if (hash === undefined) {
        throw new Error("Transaction hash is undefined");
        return;
      }

      console.log(
        `MinaNFT ${description} transaction sent, see details at:
${MINAEXPLORER}/transaction/${hash}`
      );
      if (wait) {
        try {
          //console.log("Waiting for transaction...");
          console.time("Transaction time");
          await tx.wait({ maxAttempts: 120, interval: 60000 }); // wait 2 hours max
          console.timeEnd("Transaction time");
        } catch (error) {
          console.log("Error waiting for transaction");
        }
      }
    }
  }

  public static async wait(tx: Mina.TransactionId): Promise<void> {
    try {
      Mina.getNetworkState();
    } catch (error) {
      // We're on Berkeley
      try {
        //console.log("Waiting for transaction...");
        console.time("Transaction time");
        await tx.wait({ maxAttempts: 120, interval: 60000 }); // wait 2 hours max
        console.timeEnd("Transaction time");
      } catch (error) {
        console.log("Error waiting for transaction");
      }
    }
  }

  /**
   * Mints an NFT. Deploys and compiles the MinaNFT contract if needed. Takes a long time.
   * @param deployer Private key of the account that will mint and deploy if necessary the contract
   * @param pwdHash Hash of the password used to prove transactions
   */
  public async mint(
    deployer: PrivateKey,
    owner: Field
  ): Promise<Mina.TransactionId | undefined> {
    await MinaNFT.compile();
    //console.log("Minting NFT...");
    const sender = deployer.toPublicKey();
    const zkAppPrivateKey = PrivateKey.random();
    this.zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    const zkApp = new MinaNFTContract(this.zkAppPublicKey);

    const { root } = this.getMetadataRootAndMap();
    const storage = await this.pinToStorage();
    if (storage === undefined) {
      console.error("Storage error");
      return undefined;
    }
    const storageHash: Field = storage.hash;

    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: this.zkAppPublicKey });

    const transaction = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io" },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkApp.deploy({});
        zkApp.name.set(MinaNFT.stringToField(this.name));
        zkApp.metadata.set(root);
        zkApp.owner.set(owner);
        zkApp.storage.set(storageHash);
        zkApp.version.set(UInt64.from(1));
        zkApp.escrow.set(Field(0));
        zkApp.account.tokenSymbol.set("NFT");
        zkApp.account.zkappUri.set(storage.url);
      }
    );
    await transaction.prove();
    transaction.sign([deployer, zkAppPrivateKey]);
    const sentTx = await transaction.send();
    await MinaNFT.transactionInfo(sentTx, "mint", false);
    if (sentTx.isSuccess) {
      this.isMinted = true;
      this.metadataRoot = root;
      this.storage = storage.url;
      this.owner = owner;
      this.version = UInt64.from(1);
      this.escrow = Field(0);
      return sentTx;
    } else return undefined;

    /*
    await sleep(10 * 1000);

    // Check that the contract is deployed correctly
    await fetchAccount({ publicKey: this.zkAppPublicKey });

    const newName = zkApp.name.get();
    if (newName.toJSON() !== MinaNFT.stringToField(this.name).toJSON())
      throw new Error("Wrong name");

    const newMetadataRoot = zkApp.metadata.get();
    if (
      newMetadataRoot.data.toJSON() !== root.data.toJSON() ||
      newMetadataRoot.kind.toJSON() !== root.kind.toJSON()
    )
      throw new Error("Wrong metadata");

    const newStorage = zkApp.storage.get();
    if (newStorage.toJSON() !== storageHash.toJSON())
      throw new Error("Wrong storage");

    const newOwner = zkApp.owner.get();
    if (newOwner.toJSON() !== owner.toJSON()) throw new Error("Wrong owner");

    const newVersion = zkApp.version.get();
    if (newVersion.toJSON() !== UInt64.from(0).toJSON())
      throw new Error("Wrong version");

    const newEscrow = zkApp.escrow.get();
    if (newEscrow.toJSON() !== Field(0).toJSON())
      throw new Error("Wrong escrow");
   */
  }

  /**
   * Transfer the NFT. Compiles the contract if needed. Takes a long time.
   *
   * @param deployer Private key of the account that will commit the updates
   * @param secret old owner secret
   * @param newOwner Hash of the new owner secret
   */
  public async transfer(
    deployer: PrivateKey,
    data: EscrowData,
    signature1: Signature,
    signature2: Signature,
    signature3: Signature,
    escrow1: PublicKey,
    escrow2: PublicKey,
    escrow3: PublicKey
  ): Promise<Mina.TransactionId | undefined> {
    if (this.zkAppPublicKey === undefined) {
      throw new Error("NFT contract is not deployed");
      return;
    }

    if (this.isMinted === false) {
      throw new Error("NFT is not minted");
      return undefined;
    }

    await MinaNFT.compile();
    if (MinaNFT.verificationKey === undefined) {
      throw new Error("Compilation error");
      return undefined;
    }

    //console.log("Transferring NFT...");
    const sender = deployer.toPublicKey();
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: this.zkAppPublicKey });
    const zkApp = new MinaNFTContract(this.zkAppPublicKey);
    const tx = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io" },
      () => {
        zkApp.transfer(
          data,
          signature1,
          signature2,
          signature3,
          escrow1,
          escrow2,
          escrow3
        );
      }
    );
    await tx.prove();
    tx.sign([deployer]);
    const txSent = await tx.send();
    await MinaNFT.transactionInfo(txSent, "transfer", false);
    if (txSent.isSuccess) {
      this.owner = data.newOwner;
      this.escrow = Field(0);
      this.version = this.version.add(UInt64.from(1));
      return txSent;
    } else return undefined;
  }

  /**
   * Verify Redacted MinaNFT proof
   *
   * @param deployer Private key of the account that will commit the updates
   * @param proof Redacted MinaNFT proof
   */
  public static async verify(
    deployer: PrivateKey,
    verifier: PublicKey,
    nft: PublicKey,
    proof: RedactedMinaNFTMapStateProof
  ) {
    const zkAppPublicKey = nft;
    await MinaNFT.compileVerifier();

    console.log("Verifying the proof...");
    const sender = deployer.toPublicKey();
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppPublicKey });
    const zkApp = new MinaNFTVerifier(verifier);

    const tx = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io" },
      () => {
        zkApp.verifyRedactedMetadata(zkAppPublicKey, proof);
      }
    );
    await tx.prove();
    tx.sign([deployer]);
    const res = await tx.send();
    await MinaNFT.transactionInfo(res);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
