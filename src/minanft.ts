export { MinaNFT, MinaNFTobject, RedactedMinaNFT, VeificationKey };

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
  Proof,
  Cache,
} from "o1js";

import { MinaNFTContract } from "./contract/nft";
import { Metadata, Update } from "./contract/metadata";
import {
  MinaNFTMetadataUpdate,
  MetadataTransition,
  MetadataUpdate,
  MetadataMap,
  MinaNFTMetadataUpdateProof,
} from "./plugins/update";
import { MinaNFTUpdater } from "./plugins/updater";
import { EscrowData } from "./contract/escrow";

import {
  RedactedMinaNFTMapCalculation,
  RedactedMinaNFTMapState,
  RedactedMinaNFTMapStateProof,
  MapElement,
  MetadataWitness,
} from "./plugins/redactedmap";
import { MinaNFTVerifier } from "./plugins/verifier";

import { MINAURL, ARCHIVEURL, MINAEXPLORER } from "../src/config.json";

const transactionFee = 150_000_000; // TODO: use current market fees

interface VeificationKey {
  data: string;
  hash: string | Field;
}

class MinaNFTobject {
  metadata: Map<string, string>; // metadata of file
  root?: Field; // root of Merkle tree with file data

  constructor() {
    this.metadata = new Map<string, string>();
  }
}

class BaseMinaNFT {
  protected metadata: Map<string, Metadata>;
  static verificationKey: VeificationKey | undefined;
  static updaterVerificationKey: VeificationKey | undefined;
  static updateVerificationKey: string | undefined;
  static verifierVerificationKey: VeificationKey | undefined;
  static redactedMapVerificationKey: string | undefined;

  constructor() {
    this.metadata = new Map<string, Metadata>();
  }

  /**
   * Gets public attribute
   * @param key key of the attribute
   * @returns value of the attribute
   */
  public getMetadata(key: string): Metadata | undefined {
    return this.metadata.get(key);
  }

  /**
   * updates Metadata with key and value
   * @param mapToUpdate map to update
   * @param keyToUpdate key to update
   * @param newValue new value
   * @returns MapUpdate object
   */
  protected updateMetadataMap(
    keyToUpdate: string,
    newValue: Metadata
  ): MetadataUpdate {
    const { root, map } = this.getMetadataRootAndMap();
    const key = MinaNFT.stringToField(keyToUpdate);
    const witness: MetadataWitness = map.getWitness(key);
    const oldValue: Metadata = map.get(key);
    this.metadata.set(keyToUpdate, newValue);
    map.set(key, newValue);
    const newRoot: Metadata = map.getRoot();

    return {
      oldRoot: root,
      newRoot,
      key,
      oldValue,
      newValue,
      witness,
    } as MetadataUpdate;
  }

  /**
   * Calculates a root and MerkleMap of the publicAttributes
   * @returns Root and MerkleMap of the publicAttributes
   */
  public getMetadataRootAndMap(): { root: Metadata; map: MetadataMap } {
    return this.getMapRootAndMap(this.metadata);
  }

  /**
   * Calculates a root and MerkleMap of the Map
   * @param data Map to calculate root and MerkleMap
   * @returns Root and MerkleMap of the Map
   */
  protected getMapRootAndMap(data: Map<string, Metadata>): {
    root: Metadata;
    map: MetadataMap;
  } {
    const map: MetadataMap = new MetadataMap();
    data.forEach((value: Metadata, key: string) => {
      const keyField = MinaNFT.stringToField(key);
      map.data.set(keyField, value.data);
      map.kind.set(keyField, value.kind);
    });
    return {
      root: new Metadata({
        data: map.data.getRoot(),
        kind: map.kind.getRoot(),
      }),
      map,
    };
  }
  /*
  public async getPublicJson(): Promise<object | undefined> {
    if (!this.publicAttributes.get("image")) return undefined;
    const publicAttributes: MerkleMap = new MerkleMap();
    Object.keys(this.publicAttributes).map((key) => {
      const value = this.publicAttributes.get(key);
      if (value) publicAttributes.set(MinaNFT.stringToField(key), value);
      else {
        console.error("Map error");
        return undefined;
      }
    });
    const publicMapRoot: string = publicAttributes.getRoot().toJSON();
    return {
      publicMapRoot,
      publicAttributes: MinaNFT.mapToJSON(this.publicAttributes),
    };
  }
*/

  /**
   * Converts a string to a Field
   * @param item string to convert
   * @returns string as a Field
   */
  public static stringToField(item: string): Field {
    const fields: Field[] = Encoding.stringToFields(item);
    if (fields.length === 1) return fields[0];
    else
      throw new Error(
        `stringToField error: string ${item} is too long, requires ${fields.length} Fields`
      );
  }

  /**
   * Creates a Map from JSON
   * @param map map to convert
   * @returns map as JSON object
   */
  public static mapFromJSON(json: Object): Map<string, string> {
    const map: Map<string, string> = new Map<string, string>();
    Object.entries(json).forEach(([key, value]) => map.set(key, value));
    return map;
  }

  /**
   * Converts a Map to JSON
   * @param map map to convert
   * @returns map as JSON object
   */
  public static mapToJSON(map: Map<string, Field>): object {
    return Object.fromEntries(map);
  }

  /**
   * Compiles MinaNFT contract (takes a long time)
   * @returns verification key
   */
  public static async compile(): Promise<VeificationKey> {
    if (MinaNFT.verificationKey !== undefined) {
      return MinaNFT.verificationKey;
    }
    console.log("Compiling MinaNFT contract...");

    const cache: Cache = Cache.FileSystem("./nftcache");
    const { verificationKey } = await MinaNFTContract.compile({ cache });
    MinaNFT.verificationKey = verificationKey as VeificationKey;
    return MinaNFT.verificationKey;
  }

  /**
   * Compiles MinaNFT contract (takes a long time)
   * @returns verification key
   */
  public static async compileUpdater(): Promise<VeificationKey> {
    if (MinaNFT.updateVerificationKey === undefined) {
      console.log("Compiling MinaNFTMetadataUpdate contract...");
      const { verificationKey } = await MinaNFTMetadataUpdate.compile();
      MinaNFT.updateVerificationKey = verificationKey;
    }
    if (MinaNFT.updaterVerificationKey === undefined) {
      console.log("Compiling MinaNFTUpdater contract...");
      const { verificationKey } = await MinaNFTUpdater.compile();
      MinaNFT.updaterVerificationKey = verificationKey as VeificationKey;
    }
    return MinaNFT.updaterVerificationKey;
  }

  /**
   * Compiles MinaNFT contract (takes a long time)
   * @returns verification key
   */
  public static async compileVerifier(): Promise<VeificationKey> {
    if (MinaNFT.redactedMapVerificationKey === undefined) {
      console.log("Compiling RedactedMinaNFTMapCalculation contract...");
      const { verificationKey } = await RedactedMinaNFTMapCalculation.compile();
      MinaNFT.redactedMapVerificationKey = verificationKey;
    }
    if (MinaNFT.verifierVerificationKey === undefined) {
      console.log("Compiling MinaNFTVerifier contract...");
      const { verificationKey } = await MinaNFTVerifier.compile();
      MinaNFT.verifierVerificationKey = verificationKey as VeificationKey;
    }
    return MinaNFT.verifierVerificationKey;
  }

  /**
   * Compiles MinaNFT contract (takes a long time)
   * @returns verification key
   */
  public static async compileRedactedMap(): Promise<string> {
    if (MinaNFT.redactedMapVerificationKey === undefined) {
      console.log("Compiling RedactedMinaNFTMapCalculation contract...");
      const { verificationKey } = await RedactedMinaNFTMapCalculation.compile();
      MinaNFT.redactedMapVerificationKey = verificationKey;
    }
    return MinaNFT.redactedMapVerificationKey;
  }
}

class MinaNFT extends BaseMinaNFT {
  name: string;
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
    this.isMinted = zkAppPublicKey === undefined ? false : true;
    this.zkAppPublicKey = zkAppPublicKey;
    this.updates = [];
    const metadataMap = new MetadataMap();
    this.metadataRoot = metadataMap.getRoot();
    // TODO: load the NFT metadata using zkAppPublicKey
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
    updater: PublicKey,
    escrow: Field | undefined = undefined
  ) {
    if (this.zkAppPublicKey === undefined) {
      console.error("NFT contract is not deployed");
      return;
    }
    const zkAppPublicKey: PublicKey = this.zkAppPublicKey;

    if (this.updates.length === 0) {
      console.error("No updates to commit");
      return;
    }

    if (this.isMinted === false) {
      console.error("NFT is not minted");
      return;
    }

    const proof: MinaNFTMetadataUpdateProof | undefined =
      await this.generateProof();
    if (proof === undefined) {
      console.error("Proof generation error");
      return;
    }

    await MinaNFT.compileUpdater();

    const storage = await this.pinToStorage();
    if (storage === undefined) {
      console.error("Storage error");
      return;
    }
    const storageHash: Field = storage.hash;

    console.log("Commiting updates to blockchain...");
    const sender = deployer.toPublicKey();
    const zkUpdater = new MinaNFTUpdater(updater);
    const zkApp = new MinaNFTContract(zkAppPublicKey);
    await fetchAccount({ publicKey: zkAppPublicKey });
    const version: UInt64 = zkApp.version.get();
    const oldEscrow = zkApp.escrow.get();
    const newVersion: UInt64 = version.add(UInt64.from(1));
    const ownerPublicKey = ownerPrivateKey.toPublicKey();

    const update: Update = new Update({
      oldRoot: proof.publicInput.oldRoot,
      newRoot: proof.publicInput.newRoot,
      storage: storageHash,
      verifier: updater,
      version: newVersion,
      name: MinaNFT.stringToField(this.name),
      escrow: escrow ?? oldEscrow,
      owner: Poseidon.hash(ownerPublicKey.toFields()),
    });
    const signature = Signature.create(ownerPrivateKey, update.toFields());
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: updater });
    await fetchAccount({
      publicKey: zkAppPublicKey,
      tokenId: zkUpdater.token.id,
    });

    const hasAccount = Mina.hasAccount(zkAppPublicKey, zkUpdater.token.id);
    if (hasAccount === false) {
      console.log("Sending update and 1 MINA for the verification badge...");
      const tx = await Mina.transaction(
        { sender, fee: transactionFee, memo: "minanft.io" },
        () => {
          AccountUpdate.fundNewAccount(sender);
          zkUpdater.update(
            zkAppPublicKey,
            update,
            signature,
            ownerPublicKey,
            proof
          );
        }
      );
      await tx.prove();
      tx.sign([deployer]);
      const res = await tx.send();
      await MinaNFT.transactionInfo(res, "update and 1 MINA");
    } else {
      console.log("Sending update...");
      const tx = await Mina.transaction(
        { sender, fee: transactionFee, memo: "minanft.io" },
        () => {
          zkUpdater.update(
            zkAppPublicKey,
            update,
            signature,
            ownerPublicKey,
            proof
          );
        }
      );
      await tx.prove();
      tx.sign([deployer]);
      const res = await tx.send();
      await MinaNFT.transactionInfo(res, "update");
    }
    this.metadataRoot = proof.publicInput.newRoot;
  }

  private async generateProof(): Promise<
    MinaNFTMetadataUpdateProof | undefined
  > {
    await MinaNFT.compileUpdater();
    if (MinaNFT.updateVerificationKey === undefined) {
      console.error("Update verification key is undefined");
      return undefined;
    }

    console.log("Creating proofs...");
    console.time("Proofs created");
    const proofs: MinaNFTMetadataUpdateProof[] = [];
    for (const update of this.updates) {
      const state = MetadataTransition.create(update);
      const proof = await MinaNFTMetadataUpdate.update(state, update);
      proofs.push(proof);
    }
    this.updates = [];

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
    console.timeEnd("Proofs created");
    //console.log("Proof verification result:", verificationResult);
    if (verificationResult === false) {
      console.error("Proof verification error");
      return undefined;
    }
    return proof;
  }

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
    description: string = ""
  ): Promise<void> {
    try {
      Mina.getNetworkState();
    } catch (error) {
      const hash = tx.hash();
      if (hash === undefined) {
        console.error("Send fail", tx);
        return;
      }
      if (hash.substring(0, 4) === "Info") return; // We are on local blockchain

      console.log(
        `MinaNFT ${description} transaction sent, see details at:
${MINAEXPLORER}/transaction/${hash}`
      );
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
   * Deploys the MinaNFT contract (takes a long time, and compiles the contract if needed)
   * @param deployer Private key of the account that will deploy the contract

  public async deploy(deployer: PrivateKey): Promise<void> {
    if (this.zkAppPublicKey !== undefined) {
      console.error("already deployed");
      return;
    }
    await MinaNFT.compile();
    const sender = deployer.toPublicKey();
    const zkAppPrivateKey = PrivateKey.random();
    this.zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    console.log(
      `deploying NFT contract to address ${this.zkAppPublicKey.toBase58()} using deployer with public key ${sender.toBase58()}...`
    );
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: this.zkAppPublicKey });

    const zkApp = new MinaNFTContract(this.zkAppPublicKey);
    const transaction = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io" },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkApp.deploy({ verificationKey: MinaNFT.verificationKey });
      }
    );
    await transaction.prove();
    transaction.sign([deployer, zkAppPrivateKey]);

    //console.log("Sending the deploy transaction...");
    const res = await transaction.send();
    await MinaNFT.transactionInfo(res);
  }
   */

  /**
   * Mints an NFT. Deploys and compiles the MinaNFT contract if needed. Takes a long time.
   * @param deployer Private key of the account that will mint and deploy if necessary the contract
   * @param pwdHash Hash of the password used to prove transactions
   */
  public async mint(deployer: PrivateKey, owner: Field): Promise<void> {
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
      return;
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
        zkApp.version.set(UInt64.from(0));
        zkApp.escrow.set(Field(0));
        zkApp.account.tokenSymbol.set("NFT");
        zkApp.account.zkappUri.set("https://minanft.io/@test");
      }
    );
    await transaction.prove();
    transaction.sign([deployer, zkAppPrivateKey]);
    const sentTx = await transaction.send();
    await MinaNFT.transactionInfo(sentTx, "mint");
    this.isMinted = true;
    this.metadataRoot = root;
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
  ): Promise<void> {
    if (this.zkAppPublicKey === undefined) {
      console.error("NFT contract is not deployed");
      return;
    }

    if (this.isMinted === false) {
      console.error("NFT is not minted");
      return;
    }

    await MinaNFT.compile();
    if (MinaNFT.verificationKey === undefined) {
      console.error("Compilation error");
      return;
    }

    console.log("Transferring NFT...");
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
    const res = await tx.send();
    await MinaNFT.transactionInfo(res, "transfer");

    await sleep(10 * 1000);
    await fetchAccount({ publicKey: this.zkAppPublicKey });
    const newOwner_ = zkApp.owner.get();
    if (newOwner_.toJSON() !== data.newOwner.toJSON())
      throw new Error("Transfer failed");
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

class RedactedMinaNFT extends BaseMinaNFT {
  nft: MinaNFT;

  constructor(nft: MinaNFT) {
    super();
    this.nft = nft;
  }

  /**
   * copy public attribute
   * @param key key of the attribute
   */
  public copyMetadata(key: string) {
    const value: Metadata | undefined = this.nft.getMetadata(key);
    if (value) this.metadata.set(key, value);
    else throw new Error("Map error");
  }

  /**
   *
   * @returns proof
   */
  public async proof(): Promise<RedactedMinaNFTMapStateProof> {
    await MinaNFT.compileRedactedMap();

    console.log("Creating proof for redacted maps...");

    const { root, map } = this.getMetadataRootAndMap();
    const { root: originalRoot, map: originalMap } =
      this.nft.getMetadataRootAndMap();
    const elements: MapElement[] = [];
    const originalWitnesses: MetadataWitness[] = [];
    const redactedWitnesses: MetadataWitness[] = [];
    this.metadata.forEach((value: Metadata, key: string) => {
      const keyField = MinaNFT.stringToField(key);
      const redactedWitness = map.getWitness(keyField);
      const originalWitness = originalMap.getWitness(keyField);
      const element: MapElement = {
        originalRoot: originalRoot,
        redactedRoot: root,
        key: keyField,
        value,
        //originalWitness,
        //redactedWitness,
      };
      elements.push(element);
      originalWitnesses.push(originalWitness);
      redactedWitnesses.push(redactedWitness);
    });

    const proofs: Proof<RedactedMinaNFTMapState, void>[] = [];
    for (let i = 0; i < elements.length; i++) {
      const state = RedactedMinaNFTMapState.create(
        elements[i],
        originalWitnesses[i],
        redactedWitnesses[i]
      );
      const proof = await RedactedMinaNFTMapCalculation.create(
        state,
        elements[i],
        originalWitnesses[i],
        redactedWitnesses[i]
      );
      proofs.push(proof);
    }

    //console.log("Merging redacted proofs...");
    let proof: RedactedMinaNFTMapStateProof = proofs[0];
    for (let i = 1; i < proofs.length; i++) {
      const state = RedactedMinaNFTMapState.merge(
        proof.publicInput,
        proofs[i].publicInput
      );
      const mergedProof = await RedactedMinaNFTMapCalculation.merge(
        state,
        proof,
        proofs[i]
      );
      proof = mergedProof;
    }

    if (MinaNFT.redactedMapVerificationKey === undefined) {
      throw new Error("Redacted map verification key is missing");
    }

    const verificationResult: boolean = await verify(
      proof.toJSON(),
      MinaNFT.redactedMapVerificationKey
    );

    //console.log("Proof verification result:", verificationResult);
    if (verificationResult === false) {
      throw new Error("Proof verification error");
    }

    return proof;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
