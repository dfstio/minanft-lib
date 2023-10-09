import {
  Mina,
  PrivateKey,
  PublicKey,
  Field,
  fetchAccount,
  fetchTransactionStatus,
  TransactionStatus,
  shutdown,
  AccountUpdate,
  SmartContract,
  state,
  State,
  method,
  Signature,
  UInt64,
  DeployArgs,
  Permissions,
  Poseidon,
  Proof,
  MerkleTree,
  MerkleMapWitness,
  Encoding,
  MerkleWitness,
  SelfProof,
  Experimental,
  verify,
  MerkleMap,
} from "o1js"; //TODO: remove unused
import { MinaNFTContract } from "./contract"
import { MINAURL } from "./config";
const transactionFee = 100_000_000; // TODO: use current market fees

interface VeificationKey {
  data: string;
  hash: string | Field;
}

/*
class MinaNFTfile {
  metadata: Map<string, string>; // metadata of file
  root?: Field; // root of Merkle tree with file data

  constructor() {
    this.metadata = new Map<string, string>();
  }
}

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
  spaces: Map<string, Field>
  static verificationKey: VeificationKey | undefined;
  zkAppPublicKey: PublicKey | undefined;
  /*
  publicData: Map<string, string>; // public data like name, image, description
  privateData: Map<string, string>;
  salt?: Field;
  secret?: Field;
  publicFiles?: Map<string, MinaNFTfile>; // public files and long text fields like description
  privateFiles?: Map<string, MinaNFTfile>;
  posts?: Map<string, MinaNFTpost>;
  */

  constructor(name: string, zkAppPublicKey: PublicKey | undefined = undefined) {
    this.name = name;
    this.spaces = new Map<string, Field>();
    this.zkAppPublicKey = zkAppPublicKey;
    /*
    this.publicData = new Map<string, string>();
    this.privateData = new Map<string, string>();
    this.secret = Field.random();
    this.salt = Field.random();
    */
  }

  public static async minaInit(network: string = MINAURL): Promise<void> {
    const Network = Mina.Network(network);
    Mina.setActiveInstance(Network);
  }

  public async getSpacesRootAndMap(): Promise<{ root: Field, map: MerkleMap } | undefined> {
    // check if spaces are empty - there should be at least description and image
    if (!this.spaces.get("description") || !this.spaces.get("image"))
      return undefined;
    const spaces: MerkleMap = new MerkleMap();
    //console.log("this.spaces", this.spaces)
    this.spaces.forEach((value: Field, key: string) => {
      console.log(key, value.toJSON());
      spaces.set(
        MinaNFT.stringToField(key),
        value
      );
    });
    console.log("spaces root", spaces.getRoot())
    return { root: spaces.getRoot(), map: spaces };
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
  public static stringToField(item: string): Field {
    return Encoding.stringToFields(item)[0]
  }

  public static mapToJSON(map: Map<string, string>): Object {
    return Object.fromEntries(map)
  }

  public static mapFromJSON(json: Object): Map<string, string> {
    const map: Map<string, string> = new Map<string, string>()
    Object.entries(json).forEach(([key, value]) => map.set(key, value))
    return map
  }

  public static async compile(): Promise<VeificationKey> {
    if (this.verificationKey !== undefined) {
      return this.verificationKey;
    }
    console.log("compiling zkapp...");
    const { verificationKey } = await MinaNFTContract.compile()
    this.verificationKey = verificationKey as VeificationKey;
    return this.verificationKey
  }

  public async deploy(deployer: PrivateKey): Promise<void> {
    if (this.zkAppPublicKey !== undefined) {
      console.error("already deployed")
      return
    }
    await MinaNFT.compile();
    const sender = deployer.toPublicKey();
    const zkAppPrivateKey = PrivateKey.random();
    this.zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    console.log("using deployer private key with public key", sender.toBase58())
    console.log("Deploying zkapp to address", this.zkAppPublicKey.toBase58());

    const zkApp = new MinaNFTContract(this.zkAppPublicKey);
    const transaction = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        AccountUpdate.fundNewAccount(sender);
        // NOTE: this calls `init()` if this is the first deploy
        zkApp.deploy({ verificationKey: MinaNFT.verificationKey });
      },
    );
    await transaction.prove();
    transaction.sign([deployer, zkAppPrivateKey]);

    console.log("Sending the deploy transaction...");
    const res = await transaction.send();
    const hash = res.hash();
    if (hash === undefined) {
      console.log("error sending transaction (see above)");
    } else {
      console.log(
        "See deploy transaction at",
        "https://berkeley.minaexplorer.com/transaction/" + hash,
      );
      console.log("waiting for zkApp account to be deployed...");
      await res.wait();
    }
  }

  public async create(deployer: PrivateKey): Promise<void> {
    if (this.zkAppPublicKey === undefined) {
      console.log("deploying NFT contract...")
      await this.deploy(deployer);
    }
    if (this.zkAppPublicKey === undefined) {
      console.error("Error deploying NFT contract...")
      return
    }
    const zkApp = new MinaNFTContract(this.zkAppPublicKey);
    console.log("Creating NFT...");
    const sender = deployer.toPublicKey();
    const spacesRoot = await this.getSpacesRootAndMap();
    if (spacesRoot === undefined) {
      console.error("spaces are empty")
      return
    }
    const { root } = spacesRoot;
    await MinaNFT.compile();
    const tx = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        zkApp.createNFT(MinaNFT.stringToField(this.name), root);
      },
    );

    await tx.prove();
    tx.sign([deployer]);
    const sentTx = await tx.send();

    if (sentTx.hash() !== undefined) {
      console.log(`
  Success! Create NFT transaction sent.

  Your smart contract state will be updated
  as soon as the transaction is included in a block:
  https://berkeley.minaexplorer.com/transaction/${sentTx.hash()}
  `);
      await sentTx.wait();
    } else console.error("Send fail", sentTx);
  }

  public async updateSpaces(deployer: PrivateKey): Promise<void> {
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
  Success! Update NFT Spaces transaction sent.

  Your smart contract state will be updated
  as soon as the transaction is included in a block:
  https://berkeley.minaexplorer.com/transaction/${sentTx.hash()}
  `);
      await sentTx.wait();
    } else console.error("Send fail", sentTx);
  }

}

export { MinaNFT }
