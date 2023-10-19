import {
  Mina,
  PrivateKey,
  PublicKey,
  Field,
  AccountUpdate,
  Encoding,
  MerkleMap,
  Proof,
  verify,
  fetchAccount,
  Poseidon,
} from "o1js";
//import cliProgress from "cli-progress";
import { MinaNFTContract } from "./contract/minanft";
import { MinaNFTUpdate, MinaNFTState, MapUpdate } from "./contract/map";
//import { MinaNFTTree } from "./contract/tree";

const transactionFee = 100_000_000; // TODO: use current market fees

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

/*
class MinaNFTpost {
  publicAttributes: Map<string, string>;
  publicObjects?: Map<string, MinaNFTobject>;
  privateAttributes: Map<string, string>;
  privateObjects?: Map<string, MinaNFTobject>;

  constructor() {
    this.publicAttributes = new Map<string, string>();
    this.privateAttributes = new Map<string, string>();
  }
}
*/

class MinaNFT {
  name: string;
  isMinted: boolean;
  private publicAttributes: Map<string, Field>; // public data like name, image, description
  private publicObjects?: Map<string, MinaNFTobject>; // public files and long text fields like description
  private privateAttributes: Map<string, Field>; // private data
  private privateObjects?: Map<string, MinaNFTobject>; // private files and long text fields

  static verificationKey: VeificationKey | undefined;
  zkAppPublicKey: PublicKey | undefined;
  static updateVerificationKey?: string;
  //static treeVerificationKey?: string

  private publicAttributesUpdates: MapUpdate[];
  private privateAttributesUpdates: MapUpdate[];

  private publicAttributesRoot: Field;
  private publicObjectsRoot: Field;
  private privateAttributesRoot: Field;
  private privateObjectsRoot: Field;

  /**
   * Create MinaNFT object
   * @param name Name of NFT
   * @param zkAppPublicKey Public key of the deployed NFT zkApp
   */
  constructor(name: string, zkAppPublicKey: PublicKey | undefined = undefined) {
    this.name = name;
    this.isMinted = zkAppPublicKey === undefined ? false : true;
    this.zkAppPublicKey = zkAppPublicKey;
    this.publicAttributes = new Map<string, Field>();
    this.privateAttributes = new Map<string, Field>();
    this.publicAttributesUpdates = [];
    this.privateAttributesUpdates = [];
    const emptyMap = new MerkleMap();
    const emptyRoot = emptyMap.getRoot();
    this.publicAttributesRoot = emptyRoot;
    this.privateAttributesRoot = emptyRoot;
    this.publicObjectsRoot = emptyRoot;
    this.privateObjectsRoot = emptyRoot;
    // TODO: load the NFT metadata using zkAppPublicKey
  }

  /**
   * Initialize Mina o1js library
   * @param network Mina network to use. Default is local network
   */
  public static minaInit(network: string | undefined = undefined): void {
    const Network =
      network === undefined
        ? Mina.LocalBlockchain({ proofsEnabled: true })
        : Mina.Network(network);
    Mina.setActiveInstance(Network);
    //console.log('o1js is ready')
  }

  /**
   * updates public MerkleMap with key and value
   * @param key key to update
   * @param value value to update
   */
  public updatePublicAttribute(key: string, value: Field): void {
    if (this.isMinted)
      this.publicAttributesUpdates.push(
        this.updateMap(this.publicAttributes, key, value)
      );
    else this.publicAttributes.set(key, value);
  }

  public updatePrivateAttribute(key: string, value: Field): void {
    if (this.isMinted)
      this.privateAttributesUpdates.push(
        this.updateMap(this.privateAttributes, key, value)
      );
    else this.privateAttributes.set(key, value);
  }

  /**
   * updates MerkleMap with key and value
   * @param mapToUpdate map to update
   * @param keyToUpdate key to update
   * @param newValue new value
   * @returns MapUpdate object
   */
  private updateMap(
    mapToUpdate: Map<string, Field>,
    keyToUpdate: string,
    newValue: Field
  ): MapUpdate {
    const { root, map } = this.getMapRootAndMap(mapToUpdate);
    const key = MinaNFT.stringToField(keyToUpdate);
    const witness = map.getWitness(key);
    const currentValue = map.get(key);

    mapToUpdate.set(keyToUpdate, newValue);
    map.set(key, newValue);
    const latestRoot = map.getRoot();

    return {
      initialRoot: root,
      latestRoot,
      key,
      currentValue,
      newValue,
      witness,
    } as MapUpdate;
  }

  /**
   * Commit updates of the MinaNFT to blockchain
   * Generates recursive proofs for all updates,
   * than verify the proof locally and send the transaction to the blockchain
   *
   * @param deployer Private key of the account that will commit the updates
   */
  public async commit(deployer: PrivateKey, secret: Field) {
    if (this.zkAppPublicKey === undefined) {
      console.error("NFT contract is not deployed");
      return;
    }
    if (
      this.publicAttributesUpdates.length === 0 &&
      this.privateAttributesUpdates.length === 0
    ) {
      console.error("No updates to commit");
      return;
    }

    if (this.isMinted === false) {
      console.error("NFT is not minted");
      return;
    }

    await MinaNFT.compile();
    if (MinaNFT.updateVerificationKey === undefined) {
      console.error("Compilation error");
      return;
    }

    const proof: Proof<MinaNFTState, void> = await this.generateProof(
      MinaNFT.updateVerificationKey
    );

    console.log("Commiting updates to blockchain...");
    const sender = deployer.toPublicKey();
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: this.zkAppPublicKey });
    const zkApp = new MinaNFTContract(this.zkAppPublicKey);
    const tx = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io" },
      () => {
        zkApp.update(secret, proof);
      }
    );
    await tx.prove();
    tx.sign([deployer]);
    const res = await tx.send();
    await MinaNFT.transactionInfo(res);
    this.publicAttributesRoot = proof.publicInput.publicAttributes.latestRoot;
    this.publicObjectsRoot = proof.publicInput.publicObjects.latestRoot;
    this.privateAttributesRoot = proof.publicInput.privateAttributes.latestRoot;
    this.privateObjectsRoot = proof.publicInput.privateObjects.latestRoot;
  }

  private async generateProof(
    verificationKey: string
  ): Promise<Proof<MinaNFTState, void>> {
    /*
    const bar = new cliProgress.SingleBar(
      {},
      cliProgress.Presets.shades_classic
    );
    bar.start(updates.length * 2 - 1, 0);
    */

    console.log("Creating proofs for updates...");
    const proofs: Proof<MinaNFTState, void>[] = [];
    let publicAttributesRoot = this.publicAttributesRoot;
    let publicObjectsRoot = this.publicObjectsRoot;
    let privateAttributesRoot = this.privateAttributesRoot;
    let privateObjectsRoot = this.privateObjectsRoot;

    for (const update of this.publicAttributesUpdates) {
      const state = MinaNFTState.updatePublicAttributes(
        update,
        publicObjectsRoot,
        privateAttributesRoot,
        privateObjectsRoot
      );
      const proof = await MinaNFTUpdate.updatePublicAttributes(
        state,
        update,
        publicObjectsRoot,
        privateAttributesRoot,
        privateObjectsRoot
      );
      proofs.push(proof);
      publicAttributesRoot = proof.publicInput.publicAttributes.latestRoot;
      //bar.increment();
    }

    for (const update of this.privateAttributesUpdates) {
      const state = MinaNFTState.updatePrivateAttributes(
        publicAttributesRoot,
        publicObjectsRoot,
        update,
        privateObjectsRoot
      );
      const proof = await MinaNFTUpdate.updatePrivateAttributes(
        state,
        publicAttributesRoot,
        publicObjectsRoot,
        update,
        privateObjectsRoot
      );
      proofs.push(proof);
      privateAttributesRoot = proof.publicInput.privateAttributes.latestRoot;
      //bar.increment();
    }

    console.log("Merging proofs...");
    let proof: Proof<MinaNFTState, void> = proofs[0];
    for (let i = 1; i < proofs.length; i++) {
      const state = MinaNFTState.merge(
        proof.publicInput,
        proofs[i].publicInput
      );
      const mergedProof = await MinaNFTUpdate.merge(state, proof, proofs[i]);
      proof = mergedProof;
      //bar.increment();
    }
    //console.log('verifying proof:');
    //console.log(proof.publicInput.latestRoot.toString());
    const verificationResult: boolean = await verify(
      proof.toJSON(),
      verificationKey
    );
    //bar.stop();
    console.log("Proof verification result:", verificationResult);
    if (verificationResult === false) {
      console.error("Proof verification error");
    }

    return proof;
  }

  /**
   * Calculates a root and MerkleMap of the publicAttributes
   * @returns Root and MerkleMap of the publicAttributes
   */
  public getPublicMapRootAndMap(): { root: Field; map: MerkleMap } | undefined {
    // check if publicAttributes is empty - there should be at least image
    if (!this.publicAttributes.get("image")) return undefined;
    else return this.getMapRootAndMap(this.publicAttributes);
  }

  /**
   * Calculates a root and MerkleMap of the privateAttributes
   * @returns Root and MerkleMap of the privateAttributes
   */
  public getPrivateMapRootAndMap(): { root: Field; map: MerkleMap } {
    return this.getMapRootAndMap(this.privateAttributes);
  }

  /**
   * Calculates a root and MerkleMap of the Map
   * @param data Map to calculate root and MerkleMap
   * @returns Root and MerkleMap of the Map
   */
  private getMapRootAndMap(data: Map<string, Field>): {
    root: Field;
    map: MerkleMap;
  } {
    const map: MerkleMap = new MerkleMap();
    data.forEach((value: Field, key: string) => {
      //console.log(key, value.toJSON());
      map.set(MinaNFT.stringToField(key), value);
    });
    //console.log("root", map.getRoot())
    return { root: map.getRoot(), map };
  }

  /*
  public async getPublicJson(): Promise<Object | undefined> {
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
    return { publicMapRoot, publicAttributes: MinaNFT.mapToJSON(this.publicAttributes) };
  }

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

  //TODO: write tests for string convertions and check errors for long strings that do not fit into a Field
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

  // TODO: change string to Field in maps
  /**
   * Converts a Map to JSON
   * @param map map to convert
   * @returns map as JSON object
   */
  public static mapToJSON(map: Map<string, string>): Object {
    return Object.fromEntries(map);
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
   * Compiles MinaNFT contract (takes a long time)
   * @returns verification key
   */
  public static async compile(): Promise<VeificationKey> {
    if (this.verificationKey !== undefined) {
      return this.verificationKey;
    }

    /*     
    let methods =  MinaNFTTree.analyzeMethods()
    for( const method of methods) { console.log("MinaNFTtree rows:", method.rows) }
    methods =  MinaNFTMap.analyzeMethods()
    for( const method of methods) { console.log("MinaNFTMap rows:", method.rows) }
    const methods1 =  MinaNFTContract.analyzeMethods()
    //console.log("MinaNFTContract rows:", methods)
    console.log("MinaNFTContract rows:", methods1) 
    */

    console.log("compiling MinaNFT contracts...");
    //const { verificationKey : treeKey } = await MinaNFTTree.compile()
    //console.log("Tree", MinaNFTTree.analyzeMethods())
    //MinaNFT.treeVerificationKey = treeKey
    //console.log("compiling MinaNFTMap...")
    const { verificationKey: updateKey } = await MinaNFTUpdate.compile();
    MinaNFT.updateVerificationKey = updateKey;

    //console.log("compiling MinaNFTContract...")
    const { verificationKey } = await MinaNFTContract.compile();
    this.verificationKey = verificationKey as VeificationKey;
    return this.verificationKey;
  }

  private static async transactionInfo(tx: Mina.TransactionId): Promise<void> {
    let showInfo: boolean = false;
    try {
      const state = Mina.getNetworkState();
      const blockchainLength = state.blockchainLength.toJSON();
      if (Number(blockchainLength) > 100) showInfo = true;
    } catch (error) {
      showInfo = true;
      console.log("Mina.getNetworkState() error");
    }

    if (showInfo) {
      if (tx.hash() !== undefined) {
        console.log(`
      Success! MinaNFT transaction sent.
    
      Your smart contract state will be updated
      as soon as the transaction is included in a block:
      https://berkeley.minaexplorer.com/transaction/${tx.hash()}
      `);
        try {
          await tx.wait();
        } catch (error) {
          console.log("Error waiting for transaction");
        }
      } else console.error("Send fail", tx);
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
  public async mint(deployer: PrivateKey, pwdHash: Field): Promise<void> {
    await MinaNFT.compile();
    console.log("Minting NFT...");
    const sender = deployer.toPublicKey();
    const zkAppPrivateKey = PrivateKey.random();
    this.zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    const zkApp = new MinaNFTContract(this.zkAppPublicKey);

    const publicAttributesData = await this.getPublicMapRootAndMap();
    const privateAttributesData = await this.getPrivateMapRootAndMap();
    const emptyMap = new MerkleMap(); // TODO: generate map for files
    const emptyRoot = emptyMap.getRoot();
    if (
      publicAttributesData === undefined ||
      privateAttributesData === undefined
    ) {
      console.error("wrong NFT maps data");
      return;
    }
    const { root: publicAttributesRoot } = publicAttributesData;
    const { root: privateAttributesRoot } = privateAttributesData;

    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: this.zkAppPublicKey });
    /*
        export class MinaNFTContract extends SmartContract {
          @state(Field) name = State<Field>();
          @state(Field) publicAttributesRoot = State<Field>(); // Merkle root of public key-values attributes Map
          @state(Field) publicObjectsRoot = State<Field>(); // Merkle root of public Objects Map
          @state(Field) privateAttributesRoot = State<Field>(); // Merkle root of private key-values attributes Map
          @state(Field) privateObjectsRoot = State<Field>(); // Merkle root of private Objects Map
          // URI format: ipfs:IPFS_HASH or arweave:ARWEAVE_HASH
          @state(Field) uri1 = State<Field>(); // First part of uri hash converted from string to Field
          @state(Field) uri2 = State<Field>(); // Second part of uri hash converted from string to Field
          @state(Field) pwdHash = State<Field>(); // Hash of password used to prove transactions
        )
    */
    const transaction = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io" },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkApp.deploy({});
        zkApp.name.set(MinaNFT.stringToField(this.name));
        zkApp.publicAttributesRoot.set(publicAttributesRoot);
        zkApp.publicObjectsRoot.set(emptyRoot);
        zkApp.privateAttributesRoot.set(privateAttributesRoot);
        zkApp.privateObjectsRoot.set(emptyRoot);
        zkApp.uri1.set(MinaNFT.stringToField("ipfs:"));
        zkApp.uri2.set(MinaNFT.stringToField("none"));
        zkApp.pwdHash.set(pwdHash);
      }
    );
    await transaction.prove();
    transaction.sign([deployer, zkAppPrivateKey]);
    const sentTx = await transaction.send();
    await MinaNFT.transactionInfo(sentTx);
    this.isMinted = true;
    this.publicAttributesRoot = publicAttributesRoot;
    this.publicObjectsRoot = emptyRoot;
    this.privateAttributesRoot = privateAttributesRoot;
    this.privateObjectsRoot = emptyRoot;
    await sleep(10 * 1000);
    await fetchAccount({ publicKey: this.zkAppPublicKey });
    const newName = zkApp.name.get();
    if (newName.toJSON() !== MinaNFT.stringToField(this.name).toJSON())
      throw new Error("Wrong name");
    const newPublicAttributesRoot = zkApp.publicAttributesRoot.get();
    if (newPublicAttributesRoot.toJSON() !== publicAttributesRoot.toJSON())
      throw new Error("Wrong publicAttributesRoot");
    const newPublicObjectsRoot = zkApp.publicObjectsRoot.get();
    if (newPublicObjectsRoot.toJSON() !== emptyRoot.toJSON())
      throw new Error("Wrong publicObjectsRoot");
    const newPrivateAttributesRoot = zkApp.privateAttributesRoot.get();
    if (newPrivateAttributesRoot.toJSON() !== privateAttributesRoot.toJSON())
      throw new Error("Wrong privateAttributesRoot");
    const newPrivateObjectsRoot = zkApp.privateObjectsRoot.get();
    if (newPrivateObjectsRoot.toJSON() !== emptyRoot.toJSON())
      throw new Error("Wrong privateObjectsRoot");
    const newUri1 = zkApp.uri1.get();
    if (newUri1.toJSON() !== MinaNFT.stringToField("ipfs:").toJSON())
      throw new Error("Wrong uri1");
    const newUri2 = zkApp.uri2.get();
    if (newUri2.toJSON() !== MinaNFT.stringToField("none").toJSON())
      throw new Error("Wrong uri2");
    const newPwdHash = zkApp.pwdHash.get();
    if (newPwdHash.toJSON() !== pwdHash.toJSON())
      throw new Error("Wrong pwdHash");
  }

  /**
   * Commit updates of the MinaNFT to blockchain
   * Generates recursive proofs for all updates,
   * than verify the proof locally and send the transaction to the blockchain
   *
   * @param deployer Private key of the account that will commit the updates
   */
  public async changePassword(
    deployer: PrivateKey,
    secret: Field,
    newSecret: Field
  ) {
    if (this.zkAppPublicKey === undefined) {
      console.error("NFT contract is not deployed");
      return;
    }

    if (this.isMinted === false) {
      console.error("NFT is not minted");
      return;
    }

    await MinaNFT.compile();
    if (MinaNFT.updateVerificationKey === undefined) {
      console.error("Compilation error");
      return;
    }

    console.log("Changing password...");
    const sender = deployer.toPublicKey();
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: this.zkAppPublicKey });
    const zkApp = new MinaNFTContract(this.zkAppPublicKey);
    const tx = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io" },
      () => {
        zkApp.changePassword(secret, newSecret);
      }
    );
    await tx.prove();
    tx.sign([deployer]);
    const res = await tx.send();
    await MinaNFT.transactionInfo(res);

    await sleep(10 * 1000);
    await fetchAccount({ publicKey: this.zkAppPublicKey });
    const newPwdHash = zkApp.pwdHash.get();
    if (newPwdHash.toJSON() !== Poseidon.hash([newSecret]).toJSON())
      throw new Error("Wrong new pwdHash");
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { MinaNFT, MinaNFTobject, VeificationKey };
