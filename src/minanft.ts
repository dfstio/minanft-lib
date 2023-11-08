export {
  MinaNFT,
  MinaNFTobject,
  MinaNFTStringUpdate,
  MinaNFTFieldUpdate,
  MinaNFTImageUpdate,
  MinaNFTTextUpdate,
};

import {
  Mina,
  PrivateKey,
  PublicKey,
  Field,
  AccountUpdate,
  verify,
  fetchAccount,
  Poseidon,
  Signature,
  UInt64,
} from "o1js";

import { BaseMinaNFT, PrivateMetadata } from "./baseminanft";
import { MinaNFTContract } from "./contract/nft";
import { Metadata, Update, Storage } from "./contract/metadata";
import {
  MinaNFTMetadataUpdate,
  MetadataTransition,
  MetadataUpdate,
  MetadataMap,
  MinaNFTMetadataUpdateProof,
} from "./contract/update";
import { EscrowTransfer, EscrowApproval } from "./contract/escrow";

import { RedactedMinaNFTMapStateProof } from "./plugins/redactedmap";
import { MinaNFTVerifier } from "./plugins/verifier";
import { TextData } from "./storage/text";

import { MINAURL, ARCHIVEURL, MINAFEE } from "../src/config.json";

class MinaNFTobject {
  metadata: Map<string, string>; // metadata of file
  root?: Field; // root of Merkle tree with file data

  constructor() {
    this.metadata = new Map<string, string>();
  }
}

/**
 * MinaNFTStringUpdate is the data for the update of the metadata to be written to the NFT state
 * with string value
 * String can be maximum 31 characters long
 * @property key The key of the metadata
 * @property value The value of the metadata
 * @property kind The kind of the metadata, default is "string"
 * @property isPrivate True if the metadata is private, default is false
 */
interface MinaNFTStringUpdate {
  key: string;
  value: string;
  kind?: string;
  isPrivate?: boolean;
}

/**
 * MinaNFTTextUpdate is the data for the update of the metadata to be written to the NFT state
 * with text value
 * Text can be of any length
 * @property key The key of the metadata
 * @property text The text
 * @property isPrivate True if the text is private, default is false
 */
interface MinaNFTTextUpdate {
  key: string;
  text: string;
  isPrivate?: boolean;
}

/**
 * MinaNFTImageUpdate is the data for the update of the image to be written to the NFT state
 * Image is always public and has the key "image"
 * @property filename The filename of the image
 * @property pinataJWT Pinata JWT token for uploading to the IPFS
 */
interface MinaNFTImageUpdate {
  filename: string;
  pinataJWT: string;
}

/**
 * MinaNFTFieldUpdate is the data for the update of the metadata to be written to the NFT state
 * with Field value
 * @property key The key of the metadata
 * @property value The value of the metadata
 * @property kind The kind of the metadata, default is "string"
 * @property isPrivate True if the metadata is private, default is false
 */
interface MinaNFTFieldUpdate {
  key: string;
  value: Field;
  kind?: string;
  isPrivate?: boolean;
}

/**
 * MinaNFT is the class for the NFT, wrapper around the MinaNFTContract
 * @property name Name of the NFT
 * @property storage Storage of the NFT - IPFS (i:...) or Arweave (a:...) hash string
 * @property owner Owner of the NFT - Poseidon hash of owner's public key
 * @property escrow Escrow of the NFT - Poseidon hash of three escrow's public keys
 * @property version Version of the NFT, increases by one with the changing of the metadata or owner
 * @property isMinted True if the NFT is minted
 * @property address Public key of the deployed NFT zkApp
 * @property updates Array of the metadata updates
 * @property metadataRoot Root of the Merkle Map of the metadata
 */
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
  address: PublicKey | undefined;

  private updates: MetadataUpdate[];
  private metadataRoot: Metadata;

  /**
   * Create MinaNFT object
   * @param name Name of NFT
   * @param address Public key of the deployed NFT zkApp
   */
  constructor(name: string, address: PublicKey | undefined = undefined) {
    super();
    this.name = name;
    this.storage = "";
    this.owner = Field(0);
    this.escrow = Field(0);
    this.version = UInt64.from(0);
    this.isMinted = address === undefined ? false : true;
    this.address = address;
    this.updates = [];
    const metadataMap = new MetadataMap();
    this.metadataRoot = metadataMap.getRoot();
  }

  /**
   * Load metadata from blockchain and IPFS/Arweave
   */
  public async loadMetadata(): Promise<void> {
    if (this.address === undefined) {
      throw new Error("address is undefined");
      return;
    }
    const zkApp = new MinaNFTContract(this.address);
    const account = await fetchAccount({ publicKey: this.address });
    if (
      !Mina.hasAccount(this.address) ||
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
  public updateMetadata(key: string, value: PrivateMetadata): void {
    if (this.isMinted) {
      const update: MetadataUpdate = this.updateMetadataMap(key, value);
      this.updates.push(update);
    } else this.metadata.set(key, value);
  }

  /**
   * updates PrivateMetadata
   * @param data {@link MinaNFTStringUpdate} update data
   */
  public update(data: MinaNFTStringUpdate): void {
    this.updateMetadata(data.key, {
      data: MinaNFT.stringToField(data.value),
      kind: MinaNFT.stringToField(data.kind ?? "string"),
      isPrivate: data.isPrivate ?? false,
    } as PrivateMetadata);
  }

  /**
   * updates PrivateMetadata
   * @param data {@link MinaNFTTextUpdate} update data
   */
  public updateText(data: MinaNFTTextUpdate): void {
    const text = new TextData(data.text);
    this.updateMetadata(data.key, {
      data: text.root,
      kind: MinaNFT.stringToField("text"),
      isPrivate: data.isPrivate ?? false,
      linkedObject: text,
    } as PrivateMetadata);
  }

  /**
   * updates PrivateMetadata
   * @param data {@link MinaNFTFieldUpdate} update data
   */
  public updateField(data: MinaNFTFieldUpdate): void {
    this.updateMetadata(data.key, {
      data: data.value,
      kind: MinaNFT.stringToField(data.kind ?? "string"),
      isPrivate: data.isPrivate ?? false,
    } as PrivateMetadata);
  }

  /**
   * Checks that on-chain state is equal to off-chain state
   *
   * @returns true if on-chain state is equal to off-chain state
   */
  public async checkState(): Promise<boolean> {
    if (this.address === undefined) {
      console.error("NFT contract is not deployed");
      return false;
    }

    const address: PublicKey = this.address;
    await fetchAccount({ publicKey: address });
    if (!Mina.hasAccount(address)) {
      console.error("NFT contract is not deployed");
      return false;
    }
    const zkApp = new MinaNFTContract(address);
    let result = true;

    const version: UInt64 = zkApp.version.get();
    if (version.equals(this.version).toBoolean() === false) {
      console.error("Version mismatch");
      result = false;
    }
    const oldEscrow = zkApp.escrow.get();
    if (oldEscrow.equals(this.escrow).toBoolean() === false) {
      console.error("Escrow mismatch");
      result = false;
    }
    const oldOwner = zkApp.owner.get();
    if (oldOwner.equals(this.owner).toBoolean() === false) {
      console.error("Owner mismatch");
      result = false;
    }
    const oldMetadata = zkApp.metadata.get();
    if (oldMetadata.data.equals(this.metadataRoot.data).toBoolean() === false) {
      console.error("Metadata data mismatch");
      result = false;
    }
    if (oldMetadata.kind.equals(this.metadataRoot.kind).toBoolean() === false) {
      console.error("Metadata kind mismatch");
      result = false;
    }
    /*
    const oldStorage = zkApp.storage.get();
    if (oldStorage.equals(storageHash).toBoolean() === false) {
      throw new Error("Storage mismatch");
    }
    */
    const name = zkApp.name.get();
    if (name.equals(MinaNFT.stringToField(this.name)).toBoolean() === false) {
      console.error("Name mismatch");
      result = false;
    }
    return result;
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
    ownerPrivateKey: PrivateKey
  ): Promise<Mina.TransactionId | undefined> {
    if (this.address === undefined) {
      console.error("NFT contract is not deployed");
      return undefined;
    }
    const address: PublicKey = this.address;

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
    const storageHash: Storage = storage.hash;
    if (false === (await this.checkState())) {
      throw new Error("State verification error");
    }
    //console.log("Commiting updates to blockchain...");
    const sender = deployer.toPublicKey();
    const zkApp = new MinaNFTContract(address);
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: address });
    const version: UInt64 = zkApp.version.get();
    const newVersion: UInt64 = version.add(UInt64.from(1));
    const oldOwner = zkApp.owner.get();
    const ownerPublicKey = ownerPrivateKey.toPublicKey();
    const owner = Poseidon.hash(ownerPublicKey.toFields());
    if (oldOwner.equals(owner).toBoolean() === false) {
      throw new Error("Owner privateKey mismatch");
    }

    const update: Update = new Update({
      oldRoot: proof.publicInput.oldRoot,
      newRoot: proof.publicInput.newRoot,
      storage: storageHash,
      verifier: PrivateKey.random().toPublicKey(), //TODO: use real verifier
      version: newVersion,
      name: MinaNFT.stringToField(this.name),
      owner,
    });
    const signature = Signature.create(ownerPrivateKey, update.toFields());

    //console.log("Sending update...");
    const tx = await Mina.transaction(
      { sender, fee: await MinaNFT.fee(), memo: "minanft.io" },
      () => {
        zkApp.update(update, signature, ownerPublicKey, proof!);
      }
    );
    let sentTx: Mina.TransactionId | undefined = undefined;
    try {
      await tx.prove();
      tx.sign([deployer]);
      sentTx = await tx.send();
    } catch (error) {
      throw new Error("Prooving error");
    }
    if (sentTx === undefined) {
      throw new Error("Transaction error");
    }
    await MinaNFT.transactionInfo(sentTx, "update", false);
    const newRoot = proof!.publicInput.newRoot;
    proof = null;
    if (sentTx.isSuccess) {
      this.metadataRoot = newRoot;
      this.updates = [];
      this.version = newVersion;
      this.storage = storage.url;
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
    { hash: Storage; url: string } | undefined
  > {
    //console.log("Pinning to IPFS...");
    // TODO: pin to IPFS
    const ipfs = `i:bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi`;
    const ipfs_fields = MinaNFT.stringToFields(ipfs);
    if (ipfs_fields.length !== 2) throw new Error("IPFS hash encoding error");
    return {
      hash: new Storage({ hashString: ipfs_fields as [Field, Field] }),
      url: ipfs,
    };
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

      console.log(`MinaNFT ${description} transaction sent: ${hash}`);
      if (wait) {
        try {
          //console.log("Waiting for transaction...");
          console.time("Transaction time");
          await tx.wait({ maxAttempts: 120, interval: 60000 }); // wait 2 hours max
          console.timeEnd("Transaction time");
        } catch (error) {
          console.log("Error waiting for transaction", error);
        }
      }
    }
  }

  public static async wait(tx: Mina.TransactionId): Promise<boolean> {
    try {
      Mina.getNetworkState();
    } catch (error) {
      // We're on Berkeley
      try {
        //console.log("Waiting for transaction...");
        console.time("Transaction wait time");
        await tx.wait({ maxAttempts: 120, interval: 60000 }); // wait 2 hours max
        console.timeEnd("Transaction wait time");
        return true;
      } catch (error) {
        console.log("Error waiting for transaction", error);
        return false;
      }
    }
    return true;
  }

  /**
   * Mints an NFT. Deploys and compiles the MinaNFT contract if needed. Takes a long time.
   * @param deployer Private key of the account that will mint and deploy if necessary the contract
   * @param pwdHash Hash of the password used to prove transactions
   */
  public async mint(
    deployer: PrivateKey,
    owner: Field,
    escrow: Field = Field(0)
  ): Promise<Mina.TransactionId | undefined> {
    await MinaNFT.compile();
    //console.log("Minting NFT...");
    const sender = deployer.toPublicKey();
    const zkAppPrivateKey = PrivateKey.random();
    this.address = zkAppPrivateKey.toPublicKey();
    const zkApp = new MinaNFTContract(this.address);

    const { root } = this.getMetadataRootAndMap();
    const storage = await this.pinToStorage();
    if (storage === undefined) {
      console.error("Storage error");
      return undefined;
    }
    const storageHash: Storage = storage.hash;

    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: this.address });

    const transaction = await Mina.transaction(
      { sender, fee: await MinaNFT.fee(), memo: "minanft.io" },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkApp.deploy({});
        zkApp.name.set(MinaNFT.stringToField(this.name));
        zkApp.metadata.set(root);
        zkApp.owner.set(owner);
        zkApp.storage.set(storageHash);
        zkApp.version.set(UInt64.from(1));
        zkApp.escrow.set(escrow);
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
      this.escrow = escrow;
      this.version = UInt64.from(1);
      return sentTx;
    } else return undefined;

    /*
    await sleep(10 * 1000);

    // Check that the contract is deployed correctly
    await fetchAccount({ publicKey: this.address });

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
   * Transfer the NFT. Compiles the contract if needed.
   *
   * @param deployer Private key of the deployer
   * @param data Escrow transfer data
   * @param signature1 Signature of the first escrow
   * @param signature2 Signature of the second escrow
   * @param signature3 Signature of the third escrow
   * @param escrow1 Public key of the first escrow
   * @param escrow2 Public key of the second escrow
   * @param escrow3 Public key of the third escrow
   */
  public async transfer(
    deployer: PrivateKey,
    data: EscrowTransfer,
    signature1: Signature,
    signature2: Signature,
    signature3: Signature,
    escrow1: PublicKey,
    escrow2: PublicKey,
    escrow3: PublicKey
  ): Promise<Mina.TransactionId | undefined> {
    if (this.address === undefined) {
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
    if (false === (await this.checkState())) {
      throw new Error("State verification error");
    }
    const sender = deployer.toPublicKey();
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: this.address });
    const zkApp = new MinaNFTContract(this.address);
    const tx = await Mina.transaction(
      { sender, fee: await MinaNFT.fee(), memo: "minanft.io" },
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
   * Approve the escrow for the NFT. Compiles the contract if needed.
   *
   * @param deployer Private key of the account that will commit the updates
   * @param data Escrow approval data
   * @param signature Signature of the owner
   */
  public async approve(
    deployer: PrivateKey,
    data: EscrowApproval,
    signature: Signature,
    ownerPublicKey: PublicKey
  ): Promise<Mina.TransactionId | undefined> {
    if (this.address === undefined) {
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

    if (false === (await this.checkState())) {
      throw new Error("State verification error");
    }
    const sender = deployer.toPublicKey();
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: this.address });
    const zkApp = new MinaNFTContract(this.address);
    const tx = await Mina.transaction(
      { sender, fee: await MinaNFT.fee(), memo: "minanft.io" },
      () => {
        zkApp.approveEscrow(data, signature, ownerPublicKey);
      }
    );
    await tx.prove();
    tx.sign([deployer]);
    const txSent = await tx.send();
    await MinaNFT.transactionInfo(txSent, "approve", false);
    if (txSent.isSuccess) {
      this.escrow = data.escrow;
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
    const address = nft;
    await MinaNFT.compileVerifier();

    console.log("Verifying the proof...");
    const sender = deployer.toPublicKey();
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: address });
    const zkApp = new MinaNFTVerifier(verifier);

    const tx = await Mina.transaction(
      { sender, fee: await MinaNFT.fee(), memo: "minanft.io" },
      () => {
        zkApp.verifyRedactedMetadata(address, proof);
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
