import {
  Mina,
  PrivateKey,
  PublicKey,
  Field,
  AccountUpdate,
  Encoding,
  MerkleMap,
  Proof,
  verify
} from "o1js";
import { MinaNFTContract } from "./contract/minanft"
import { MinaNFTMap, MinaNFTMapState, MapUpdate } from "./contract/map"
import { MinaNFTTree } from "./contract/tree"

const transactionFee = 100_000_000; // TODO: use current market fees

interface VeificationKey {
  data: string;
  hash: string | Field;
}

class MinaNFTfile {
  metadata: Map<string, string>; // metadata of file
  root?: Field; // root of Merkle tree with file data

  constructor() {
    this.metadata = new Map<string, string>();
  }
}

/*
class MinaNFTpost {
  publicData: Map<string, string>;
  publicFiles?: Map<string, MinaNFTfile>;
  privateData: Map<string, string>;
  privateFiles?: Map<string, MinaNFTfile>;

  constructor() {
    this.publicData = new Map<string, string>();
    this.privateData = new Map<string, string>();
  }
}
*/

class MinaNFT {
  name: string;
  publicData: Map<string, Field> // public data like name, image, description
  privateData: Map<string, Field> // private data
  publicFiles?: Map<string, MinaNFTfile> // public files and long text fields like description
  privateFiles?: Map<string, MinaNFTfile> // private files and long text fields
  static verificationKey: VeificationKey | undefined
  zkAppPublicKey: PublicKey | undefined
  static mapVerificationKey?: string
  static treeVerificationKey?: string
  publicMapUpdates: MapUpdate[]
  privateMapUpdates: MapUpdate[]

  /**
   * Create MinaNFT object
   * @param name Name of NFT
   * @param zkAppPublicKey Public key of the deployed NFT zkApp
   */
  constructor(name: string, zkAppPublicKey: PublicKey | undefined = undefined) {
    this.name = name;
    this.zkAppPublicKey = zkAppPublicKey
    this.publicData = new Map<string, Field>()
    this.privateData = new Map<string, Field>()
    this.publicMapUpdates = []
    this.privateMapUpdates = []
    // TODO: load the NFT metadata using zkAppPublicKey
  }

  /**
   * Initialize Mina o1js library
   * @param network Mina network to use. Default is local network
   */
  public static minaInit(network: string | undefined = undefined): void {
    const Network = (network === undefined) ? Mina.LocalBlockchain({ proofsEnabled: true }) : Mina.Network(network)
    Mina.setActiveInstance(Network)
    //console.log('o1js is ready')
  }

  /**
   * updates public MerkleMap with key and value
   * @param key key to update
   * @param value value to update
   */
  public updatePublicData(key: string, value: Field): void {
    this.publicMapUpdates.push(this.updateMap(this.publicData, key, value))
  }

   /**
   * updates MerkleMap with key and value
   * @param mapToUpdate map to update
   * @param keyToUpdate key to update
   * @param newValue new value
   * @returns MapUpdate object
   */
  private updateMap(mapToUpdate: Map<string, Field>, keyToUpdate: string, newValue: Field): MapUpdate {
    const { root, map } = this.getMapRootAndMap(mapToUpdate)
    const key = MinaNFT.stringToField(keyToUpdate)
    const witness = map.getWitness(key)
    const currentValue = map.get(key)

    mapToUpdate.set(keyToUpdate, newValue)
    map.set(key, newValue)
    const latestRoot = map.getRoot();

    return { 
      initialRoot: root, 
      latestRoot, 
      key, 
      currentValue, 
      newValue, 
      witness } as MapUpdate
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
      console.error("NFT contract is not deployed")
      return
    }
    await MinaNFT.compile()
    if(MinaNFT.mapVerificationKey === undefined) { console.error("Compilation error"); return }
    console.log("Creating proofs for updates...")
    const proofs: Proof<MinaNFTMapState, void>[] = []
    for (const update of this.publicMapUpdates) {
      const state = MinaNFTMapState.create(update)
      const proof = await MinaNFTMap.create(state, update)
      proofs.push(proof)
    }
    console.log("Merging proofs...")
    let proof: Proof<MinaNFTMapState, void> = proofs[0]
    for (let i = 1; i < proofs.length; i++) {
      const state = MinaNFTMapState.merge(proof.publicInput, proofs[i].publicInput)
      const mergedProof = await MinaNFTMap.merge(state, proof, proofs[i])
      proof = mergedProof
    }
    console.log('verifying proof:');
    console.log(proof.publicInput.latestRoot.toString());
    const verificationResult : boolean = await verify(proof.toJSON(), MinaNFT.mapVerificationKey);
    console.log('verification result', verificationResult);
    if( verificationResult === false) { console.error("Verification error"); return }

    console.log("Comitting updates to blockchain...");
    const sender = deployer.toPublicKey();
    const zkApp = new MinaNFTContract(this.zkAppPublicKey);
    const tx = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        zkApp.update(secret, proof);
      },
    );
    await tx.prove();
    tx.sign([deployer]);
    const res = await tx.send();
    await MinaNFT.transactionInfo(res)
  }

  /**
   * Calculates a root and MerkleMap of the publicData
   * @returns Root and MerkleMap of the publicData
   */
  public getPublicMapRootAndMap(): { root: Field, map: MerkleMap } | undefined {
    // check if publicData is empty - there should be at least image
    if (!this.publicData.get("image")) return undefined;
    else return this.getMapRootAndMap(this.publicData)
  }

  /**
   * Calculates a root and MerkleMap of the privateData
   * @returns Root and MerkleMap of the privateData
   */
  public getPrivateMapRootAndMap(): { root: Field, map: MerkleMap } {
    return this.getMapRootAndMap(this.privateData)
  }

  /**
   * Calculates a root and MerkleMap of the Map
   * @param data Map to calculate root and MerkleMap
   * @returns Root and MerkleMap of the Map
   */
  private getMapRootAndMap(data: Map<string, Field>): { root: Field, map: MerkleMap } {
    const map: MerkleMap = new MerkleMap();
    data.forEach((value: Field, key: string) => {
      //console.log(key, value.toJSON());
      map.set(
        MinaNFT.stringToField(key),
        value
      );
    });
    //console.log("root", map.getRoot())
    return { root: map.getRoot(), map };
  }

  /*
  public async getPublicJson(): Promise<Object | undefined> {
    if (!this.publicData.get("name") || !this.publicData.get("image"))
      return undefined;
    const publicData: MerkleMap = new MerkleMap();
    Object.keys(this.publicData).map((key) => {
      const value = this.publicData.get(key);
      if (value)
        publicData.set(
          MinaNFT.stringToField(key),
          MinaNFT.stringToField(value)
        );
      else {
        console.error("Map error");
        return undefined;
      }
    });
    const publicMapRoot: string = publicData.getRoot().toJSON();
    return { publicMapRoot, publicData: MinaNFT.mapToJSON(this.publicData) };
  }

  public async getPrivateJson(): Promise<Object | undefined> {
    if (!this.publicData.get("name") || !this.publicData.get("image"))
      return undefined;
    const publicData: MerkleMap = new MerkleMap();
    Object.keys(this.publicData).map((key) => {
      const value = this.publicData.get(key);
      if (value)
        publicData.set(
          MinaNFT.stringToField(key),
          MinaNFT.stringToField(value)
        );
      else {
        console.error("Map error");
        return undefined;
      }
    });
    const publicMapRoot: string = publicData.getRoot().toJSON();

    const privateData: MerkleMap = new MerkleMap();
    Object.keys(this.privateData).map((key) => {
      const value = this.publicData.get(key);
      if (value)
        privateData.set(
          MinaNFT.stringToField(key),
          MinaNFT.stringToField(value)
        );
      else {
        console.error("Map error");
        return undefined;
      }
    });
    const privateMapRoot: string = privateData.getRoot().toJSON();

    return {
      publicMapRoot,
      privateMapRoot,
      secret: this.secret ? this.secret.toJSON() : "",
      salt: this.salt ? this.salt.toJSON() : "",
      publicData: MinaNFT.mapToJSON(this.publicData),
      privateData: MinaNFT.mapToJSON(this.privateData),
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
    return Encoding.stringToFields(item)[0]
  }


  // TODO: change string to Field in maps
  /**
   * Converts a Map to JSON
   * @param map map to convert
   * @returns map as JSON object
   */
  public static mapToJSON(map: Map<string, string>): Object {
    return Object.fromEntries(map)
  }

  /**
   * Creates a Map from JSON
   * @param map map to convert
   * @returns map as JSON object
   */
  public static mapFromJSON(json: Object): Map<string, string> {
    const map: Map<string, string> = new Map<string, string>()
    Object.entries(json).forEach(([key, value]) => map.set(key, value))
    return map
  }

  /**
   * Compiles MinaNFT contract (takes a long time)
   * @returns verification key
   */
  public static async compile(): Promise<VeificationKey> {
    if (this.verificationKey !== undefined) {
      return this.verificationKey;
    }
    console.log("compiling MinaNFTTree...")
    const { verificationKey : treeKey } = await MinaNFTTree.compile()
    MinaNFT.treeVerificationKey = treeKey
    console.log("compiling MinaNFTMap...")
    const { verificationKey : mapKey } = await MinaNFTMap.compile()
    MinaNFT.mapVerificationKey = mapKey

    console.log("compiling MinaNFTContract...")
    const { verificationKey } = await MinaNFTContract.compile()
    this.verificationKey = verificationKey as VeificationKey
    return this.verificationKey
  }

  private static async transactionInfo(tx: Mina.TransactionId): Promise<void> {
    const blockchainLength = Mina.getNetworkState().blockchainLength.toJSON()
    if (Number(blockchainLength) > 100) {

      if (tx.hash() !== undefined) {
        console.log(`
    Success! MinaNFT transaction sent.
  
    Your smart contract state will be updated
    as soon as the transaction is included in a block:
    https://berkeley.minaexplorer.com/transaction/${tx.hash()}
    `);
        await tx.wait();
      } else console.error("Send fail", tx);
    }
  }

  /**
   * Deploys the MinaNFT contract (takes a long time, and compiles the contract if needed)
   * @param deployer Private key of the account that will deploy the contract
   */
  public async deploy(deployer: PrivateKey): Promise<void> {
    if (this.zkAppPublicKey !== undefined) {
      console.error("already deployed")
      return
    }
    await MinaNFT.compile();
    const sender = deployer.toPublicKey();
    const zkAppPrivateKey = PrivateKey.random();
    this.zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    console.log("using deployer with public key", sender.toBase58())
    console.log("Deploying zkapp to address", this.zkAppPublicKey.toBase58());

    const zkApp = new MinaNFTContract(this.zkAppPublicKey);
    const transaction = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkApp.deploy({ verificationKey: MinaNFT.verificationKey });
      },
    );
    await transaction.prove();
    transaction.sign([deployer, zkAppPrivateKey]);

    console.log("Sending the deploy transaction...")
    const res = await transaction.send()
    await MinaNFT.transactionInfo(res)
  }

  /**
   * Mints an NFT. Deploys and compiles the MinaNFT contract if needed. Takes a long time.
   * @param deployer Private key of the account that will mint and deploy if necessary the contract
   * @param pwdHash Hash of the password used to prove transactions
   */
  public async mint(deployer: PrivateKey, pwdHash: Field): Promise<void> {
    if (this.zkAppPublicKey === undefined) {
      console.log("deploying NFT contract...")
      await this.deploy(deployer);
    }
    if (this.zkAppPublicKey === undefined) {
      console.error("Error deploying NFT contract...")
      return
    }
    const zkApp = new MinaNFTContract(this.zkAppPublicKey);
    console.log("Minting NFT...");
    const sender = deployer.toPublicKey();
    const publicMapData = await this.getPublicMapRootAndMap();
    const privateMapData = await this.getPrivateMapRootAndMap();
    const emptyMap = new MerkleMap(); // TODO: generate map for files
    const emptyRoot = emptyMap.getRoot();
    if (publicMapData === undefined || privateMapData === undefined) {
      console.error("wrong NFT maps data")
      return
    }
    const { root: publicMapRoot } = publicMapData;
    const { root: privateMapRoot } = privateMapData;
    await MinaNFT.compile(); // TODO: remove this line
    /*
        @method mint(
          name: Field,
          publicMapRoot: Field,
          publicFilesRoot: Field,
          privateMapRoot: Field,
          privateFilesRoot: Field,
          uri1: Field,
          uri2: Field,
          pwdHash: Field,
    */
    const tx = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        zkApp.mint(
          MinaNFT.stringToField(this.name),
          publicMapRoot,
          privateMapRoot,
          emptyRoot,
          emptyRoot,
          MinaNFT.stringToField("ipfs:"),
          MinaNFT.stringToField("none"),
          pwdHash
        );
      },
    );

    await tx.prove();
    tx.sign([deployer]);
    const sentTx = await tx.send();
    await MinaNFT.transactionInfo(sentTx)
  }

  /*
  public async updatePublicMap(deployer: PrivateKey): Promise<void> {
    if (this.zkAppPublicKey === undefined) {
      console.error("NFT is not deployed")
      return
    }
    const zkApp = new MinaNFTContract(this.zkAppPublicKey);
    console.log("Updating NFT Spaces...");
    const sender = deployer.toPublicKey();
    const spacesRoot = await this.getSpacesRootAndMap();
    if (spacesRoot === undefined) {
      console.error("Spaces are empty")
      return
    }
    const { root } = spacesRoot;
    await MinaNFT.compile();
    const tx = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        zkApp.updateSpaces(root);
      },
    );

    await tx.prove();
    tx.sign([deployer]);
    const sentTx = await tx.send();

    if (sentTx.hash() !== undefined) {
      console.log(`
    Success! Update NFT transaction sent.
  
    Your smart contract state will be updated
    as soon as the transaction is included in a block:
    https://berkeley.minaexplorer.com/transaction/${sentTx.hash()}
    `);
      await sentTx.wait();
    } else console.error("Send fail", sentTx);
  }
  */
}

export { MinaNFT, MinaNFTfile, VeificationKey }
