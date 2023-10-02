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
import { MINAURL } from "./config";

/*
export class AvatarNFT extends SmartContract {
    @state(Field) username = State<Field>();
    @state(Field) publicMapRoot = State<Field>(); // Merkle root of public key-values Map
    @state(Field) publicFilesRoot = State<Field>(); // Merkle root of public Files Map
    @state(Field) privateMapRoot = State<Field>(); // Merkle root of private key-values Map
    @state(Field) privateFilesRoot = State<Field>(); // Merkle root of private Files Map
    @state(Field) uri1 = State<Field>(); // First part of uri IPFS hash
    @state(Field) uri2 = State<Field>(); // Second part of uri IPFS hash
    @state(Field) pwdHash = State<Field>(); // Hash of password used to prove transactions
*/

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

class MinaNFT {
  publicData: Map<string, string>; // public data like name, image, description
  privateData: Map<string, string>;
  salt?: Field;
  secret?: Field;
  publicFiles?: Map<string, MinaNFTfile>; // public files and long text fields like description
  privateFiles?: Map<string, MinaNFTfile>;
  posts?: Map<string, MinaNFTpost>;

  constructor() {
    this.publicData = new Map<string, string>();
    this.privateData = new Map<string, string>();
    this.secret = Field.random();
    this.salt = Field.random();
  }

  public static async minaInit(network: string = MINAURL): Promise<void> {
    const Network = Mina.Network(network);
    Mina.setActiveInstance(Network);
  }

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

  public static stringToField(item: string): Field {
    return Encoding.stringToFields(item)[0];
  }

  public static mapToJSON(map: Map<string, string>): Object {
    return Object.fromEntries(map);
  }

  public static mapFromJSON(json: Object): Map<string, string> {
    const map: Map<string, string> = new Map<string, string>();
    Object.entries(json).forEach(([key, value]) => map.set(key, value));
    return map;
  }
}

export { MinaNFT, MinaNFTfile, MinaNFTpost };
