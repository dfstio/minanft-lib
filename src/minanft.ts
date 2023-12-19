export { MinaNFT };

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
  VerificationKey,
  Account,
} from "o1js";
import axios from "axios";

import { BaseMinaNFT } from "./baseminanft";
import { PrivateMetadata } from "./privatemetadata";
import { MinaNFTContract } from "./contract/nft";
import {
  MinaNFTNameServiceContract,
  NFTMintData,
  MintData,
} from "./contract/names";
import { Metadata, Update, Storage } from "./contract/metadata";
import {
  MinaNFTMetadataUpdate,
  MetadataTransition,
  MetadataUpdate,
  MetadataMap,
  MinaNFTMetadataUpdateProof,
} from "./contract/update";

import { RedactedMinaNFTMapStateProof } from "./plugins/redactedmap";
import { MinaNFTVerifier } from "./plugins/verifier";
import { TextData } from "./storage/text";
import { File, FileData } from "./storage/file";
import { MinaNFTMapUpdate } from "./storage/map";
import { IPFS } from "./storage/ipfs";
import {
  MinaNFTStringUpdate,
  MinaNFTFieldUpdate,
  MinaNFTImageUpdate,
  MinaNFTTextUpdate,
  MinaNFTFileUpdate,
  MinaNFTMint,
  MinaNFTTransfer,
  MinaNFTApproval,
  MinaNFTCommit,
} from "./update";
import { MapData } from "./storage/map";
import { blockchain, initBlockchain } from "./mina";
import config from "./config";
const { MINAFEE, MINANFT_NAME_SERVICE } = config;

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
  creator: string;
  storage: string;
  owner: Field;
  escrow: Field;
  version: UInt64;
  isMinted: boolean;
  address: PublicKey | undefined;
  tokenId: Field | undefined;
  nameService: PublicKey | undefined;

  private updates: MetadataUpdate[];
  private metadataRoot: Metadata;

  /**
   * Create MinaNFT object
   * @param name Name of NFT
   * @param address Public key of the deployed NFT zkApp
   */
  constructor(params: {
    name: string;
    address?: PublicKey;
    creator?: string;
    storage?: string;
    owner?: Field;
    escrow?: Field;
    nameService?: PublicKey;
  }) {
    super();
    this.name = params.name[0] === "@" ? params.name : "@" + params.name;
    this.creator = params.creator ?? "MinaNFT library";
    this.storage = params.storage ?? "";
    this.owner = params.owner ?? Field(0);
    this.escrow = params.escrow ?? Field(0);
    this.version = UInt64.from(0);
    this.isMinted = params.address === undefined ? false : true;
    this.address = params.address;
    this.updates = [];
    const metadataMap = new MetadataMap();
    this.metadataRoot = metadataMap.getRoot();
    this.nameService = params.nameService;
    if (this.nameService === undefined) {
      this.nameService = PublicKey.fromBase58(MINANFT_NAME_SERVICE);
    }
    const nameService = new MinaNFTNameServiceContract(this.nameService);
    this.tokenId = nameService.token.id;
  }

  /**
   * Load metadata from blockchain and IPFS/Arweave
   * @param metadataURI URI of the metadata. Obligatorily in case there is private metadata as private metadata cannot be fetched from IPFS/Arweave
   */
  public async loadMetadata(
    metadataURI: string | undefined = undefined
  ): Promise<void> {
    if (this.address === undefined) {
      throw new Error("address is undefined");
      return;
    }
    if (this.nameService === undefined) {
      this.nameService = PublicKey.fromBase58(MINANFT_NAME_SERVICE);
    }
    const nameService = new MinaNFTNameServiceContract(this.nameService);
    const tokenId = nameService.token.id;
    const nft = new MinaNFTContract(this.address, tokenId);
    await fetchAccount({ publicKey: this.address, tokenId });
    if (!Mina.hasAccount(this.address, tokenId)) {
      throw new Error("NFT is not deployed");
      return;
    }

    const name = nft.name.get();
    const storage = nft.storage.get();
    const owner = nft.owner.get();
    const escrow = nft.escrow.get();
    const metadata = nft.metadata.get();
    const version = nft.version.get();

    /*
      metadata: Map<string, PrivateMetadata>;
      +name: string;
      creator: string;
      +storage: string;
      +owner: Field;
      +escrow: Field;
      +version: UInt64;
      +isMinted: boolean;
      +address: PublicKey | undefined;
      +tokenId: Field | undefined;
      +nameService: PublicKey | undefined;

      +private updates: MetadataUpdate[];
      +private metadataRoot: Metadata;
    */

    const nameStr = MinaNFT.stringFromField(name);
    if (nameStr !== this.name) throw new Error("NFT name mismatch");
    const storageStr = MinaNFT.stringFromFields(storage.toFields());
    this.storage = storageStr;
    this.owner = owner;
    this.escrow = escrow;
    this.version = version;
    this.metadataRoot = metadata;
    this.isMinted = true;
    this.tokenId = tokenId;
    this.nameService = nameService.address;

    //try {
    const uri =
      metadataURI === undefined
        ? (await axios.get("https://ipfs.io/ipfs/" + storageStr.slice(2))).data
        : JSON.parse(metadataURI);
    //const image = data.data.properties.image;
    //console.log("IPFS uri:", JSON.stringify(uri, null, 2));
    //console.log("IPFS image:", image);
    this.creator = uri.creator ?? "";
    if (uri.name !== this.name) throw new Error("uri: NFT name mismatch");
    if (uri.version !== this.version.toString())
      throw new Error("uri: NFT version mismatch");
    if (uri.metadata.data !== this.metadataRoot.data.toJSON())
      throw new Error("uri: NFT metadata data mismatch");
    if (uri.metadata.kind !== this.metadataRoot.kind.toJSON())
      throw new Error("uri: NFT metadata kind mismatch");

    Object.entries(uri.properties).forEach(([key, value]) => {
      if (typeof key !== "string")
        throw new Error("uri: NFT metadata key mismatch - should be string");
      if (typeof value !== "object")
        throw new Error("uri: NFT metadata value mismatch - should be object");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const obj = value as any;
      const data = obj.data;
      const kind = obj.kind;
      const isPrivate: boolean = obj.isPrivate ?? false;
      if (data === undefined)
        throw new Error(
          `uri: NFT metadata: data should present: ${key} : ${value} kind: ${kind} daya: ${data} isPrivate: ${isPrivate}`
        );

      if (kind === undefined || typeof kind !== "string")
        throw new Error(
          `uri: NFT metadata: kind mismatch - should be string: ${key} : ${value}`
        );
      switch (kind) {
        case "text":
          this.metadata.set(
            key,
            new PrivateMetadata({
              data: Field.fromJSON(data),
              kind: MinaNFT.stringToField(kind),
              isPrivate: isPrivate,
              linkedObject: TextData.fromJSON(obj),
            })
          );
          break;
        case "string":
          this.metadata.set(
            key,
            new PrivateMetadata({
              data: MinaNFT.stringToField(data),
              kind: MinaNFT.stringToField(kind),
              isPrivate: isPrivate,
            })
          );
          break;
        case "file":
          this.metadata.set(
            key,
            new PrivateMetadata({
              data: Field.fromJSON(data),
              kind: MinaNFT.stringToField(kind),
              isPrivate: isPrivate,
              linkedObject: FileData.fromJSON(obj),
            })
          );
          break;
        case "image":
          this.metadata.set(
            key,
            new PrivateMetadata({
              data: Field.fromJSON(data),
              kind: MinaNFT.stringToField(kind),
              isPrivate: isPrivate,
              linkedObject: FileData.fromJSON(obj),
            })
          );
          break;
        case "map":
          this.metadata.set(
            key,
            new PrivateMetadata({
              data: Field.fromJSON(data),
              kind: MinaNFT.stringToField(kind),
              isPrivate: isPrivate,
              linkedObject: MapData.fromJSON(obj),
            })
          );
          break;
        default:
          this.metadata.set(
            key,
            new PrivateMetadata({
              data: Field.fromJSON(data),
              kind: MinaNFT.stringToField(kind),
              isPrivate: isPrivate,
            })
          );
          break;
      }
    });
    /*
    } catch (error) {
      throw new Error(`IPFS uri import error: ${error}`);
    }
    */
    if (!(await this.checkState("load metadata")))
      throw new Error("State verification error after loading metadata");
    const { root } = this.getMetadataRootAndMap();
    if (root.data.toJSON() !== this.metadataRoot.data.toJSON())
      throw new Error("Metadata root data mismatch");
    if (root.kind.toJSON() !== this.metadataRoot.kind.toJSON())
      throw new Error("Metadata root kind mismatch");
  }

  /**
   * Load metadata from blockchain and IPFS/Arweave
   * @param metadataURI URI of the metadata. Obligatorily in case there is private metadata as private metadata cannot be fetched from IPFS/Arweave
   * @param nameServiceAddress Public key of the Name Service
   * @param skipCalculatingMetadataRoot Skip calculating metadata root in case metadataURI does not contains private data
   * @returns MinaNFT object
   */
  public static fromJSON(params: {
    metadataURI: string;
    nameServiceAddress: PublicKey;
    skipCalculatingMetadataRoot?: boolean;
  }): MinaNFT {
    const nameService = new MinaNFTNameServiceContract(
      params.nameServiceAddress
    );
    const tokenId = nameService.token.id;
    const skipCalculatingMetadataRoot: boolean =
      params.skipCalculatingMetadataRoot ?? false;

    const uri = JSON.parse(params.metadataURI);
    const nft = new MinaNFT({
      name: uri.name,
      nameService: params.nameServiceAddress,
      creator: uri.creator,
    });
    nft.version = UInt64.from(uri.version);
    nft.metadataRoot = new Metadata({
      data: Field.fromJSON(uri.metadata.data),
      kind: Field.fromJSON(uri.metadata.kind),
    });
    nft.owner = Field.fromJSON(uri.owner);
    nft.escrow = Field.fromJSON(uri.escrow);
    nft.tokenId = tokenId;

    Object.entries(uri.properties).forEach(([key, value]) => {
      if (typeof key !== "string")
        throw new Error("uri: NFT metadata key mismatch - should be string");
      if (typeof value !== "object")
        throw new Error("uri: NFT metadata value mismatch - should be object");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const obj = value as any;
      const data = obj.data;
      const kind = obj.kind;
      const isPrivate: boolean = obj.isPrivate ?? false;
      if (data === undefined)
        throw new Error(
          `uri: NFT metadata: data should present: ${key} : ${value} kind: ${kind} daya: ${data} isPrivate: ${isPrivate}`
        );

      if (kind === undefined || typeof kind !== "string")
        throw new Error(
          `uri: NFT metadata: kind mismatch - should be string: ${key} : ${value}`
        );
      switch (kind) {
        case "text":
          nft.metadata.set(
            key,
            new PrivateMetadata({
              data: Field.fromJSON(data),
              kind: MinaNFT.stringToField(kind),
              isPrivate: isPrivate,
              linkedObject: TextData.fromJSON(obj),
            })
          );
          break;
        case "string":
          nft.metadata.set(
            key,
            new PrivateMetadata({
              data: MinaNFT.stringToField(data),
              kind: MinaNFT.stringToField(kind),
              isPrivate: isPrivate,
            })
          );
          break;
        case "file":
          nft.metadata.set(
            key,
            new PrivateMetadata({
              data: Field.fromJSON(data),
              kind: MinaNFT.stringToField(kind),
              isPrivate: isPrivate,
              linkedObject: FileData.fromJSON(obj),
            })
          );
          break;
        case "image":
          nft.metadata.set(
            key,
            new PrivateMetadata({
              data: Field.fromJSON(data),
              kind: MinaNFT.stringToField(kind),
              isPrivate: isPrivate,
              linkedObject: FileData.fromJSON(obj),
            })
          );
          break;
        case "map":
          nft.metadata.set(
            key,
            new PrivateMetadata({
              data: Field.fromJSON(data),
              kind: MinaNFT.stringToField(kind),
              isPrivate: isPrivate,
              linkedObject: MapData.fromJSON(obj, skipCalculatingMetadataRoot),
            })
          );
          break;
        default:
          nft.metadata.set(
            key,
            new PrivateMetadata({
              data: Field.fromJSON(data),
              kind: MinaNFT.stringToField(kind),
              isPrivate: isPrivate,
            })
          );
          break;
      }
    });
    return nft;
  }

  /**
   * Creates a Map from JSON
   * @param map map to convert
   * @returns map as JSON object
   */
  public static mapFromJSON(json: object): Map<string, string> {
    const map: Map<string, string> = new Map<string, string>();
    Object.entries(json).forEach(([key, value]) => map.set(key, value));
    return map;
  }

  /**
   * Converts a NFT to JSON
   * @returns map as JSON object
   */
  public toJSON(): object {
    return this.exportToJSON();
  }

  /**
   * Converts a NFT to string
   * @param increaseVersion increase version by one
   * @param includePrivateData include private data
   * @returns NFT's serialized JSON as string
   */
  public exportToString(params: {
    increaseVersion: boolean;
    includePrivateData: boolean;
  }): string {
    return params.includePrivateData
      ? JSON.stringify(this.exportToJSON(params.increaseVersion), null, 2)
      : JSON.stringify(
          this.exportToJSON(params.increaseVersion),
          (_, value) => (value?.isPrivate === true ? undefined : value),
          2
        );
  }

  /**
   * Converts a Map to JSON
   * @param increaseVersion increase version by one
   * @returns map as JSON object
   */
  public exportToJSON(increaseVersion: boolean = false): object {
    let description: string | undefined = undefined;
    const descriptionObject = this.getMetadata("description");
    if (
      descriptionObject !== undefined &&
      descriptionObject.linkedObject !== undefined &&
      descriptionObject.linkedObject instanceof TextData
    )
      description = descriptionObject.linkedObject.text;
    let image: string | undefined = undefined;
    const imageObject = this.getMetadata("image");
    if (
      imageObject !== undefined &&
      imageObject.linkedObject !== undefined &&
      imageObject.linkedObject instanceof FileData
    )
      image =
        "https://ipfs.io/ipfs/" + imageObject.linkedObject.storage.slice(2);

    const { root } = this.getMetadataRootAndMap();
    const version = increaseVersion
      ? this.version.add(UInt64.from(1)).toJSON()
      : this.version.toJSON();

    /*
    class MinaNFTContract extends SmartContract {
        @state(Field) name = State<Field>();
        @state(Metadata) metadata = State<Metadata>();
        @state(Storage) storage = State<Storage>();
        @state(Field) owner = State<Field>();
        @state(Field) escrow = State<Field>();
        @state(UInt64) version = State<UInt64>();
    */

    return {
      name: this.name,
      description: description ?? "",
      image,
      external_url: "https://minanft.io/" + this.name,
      version,
      time: Date.now(),
      creator: this.creator,
      owner: this.owner.toJSON(),
      escrow: this.escrow.toJSON(),
      metadata: { data: root.data.toJSON(), kind: root.kind.toJSON() },
      properties: Object.fromEntries(this.metadata),
    };
  }

  /**
   * Initialize Mina o1js library
   * @param local Choose Mina network to use. Default is local network
   */
  public static minaInit(chain: blockchain):
    | {
        publicKey: PublicKey;
        privateKey: PrivateKey;
      }[]
    | undefined {
    return initBlockchain(chain);
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
    this.updateMetadata(
      data.key,
      new PrivateMetadata({
        data: MinaNFT.stringToField(data.value),
        kind: MinaNFT.stringToField(data.kind ?? "string"),
        isPrivate: data.isPrivate ?? false,
      })
    );
  }

  /**
   * updates PrivateMetadata
   * @param data {@link MinaNFTTextUpdate} update data
   */
  public updateText(data: MinaNFTTextUpdate): void {
    const text = new TextData(data.text);
    this.updateMetadata(
      data.key,
      new PrivateMetadata({
        data: text.root,
        kind: MinaNFT.stringToField("text"),
        isPrivate: data.isPrivate ?? false,
        linkedObject: text,
      })
    );
  }

  /**
   * updates PrivateMetadata
   * @param data {@link MinaNFTTextUpdate} update data
   */
  public updateMap(data: MinaNFTMapUpdate): void {
    data.map.setRoot();
    this.updateMetadata(
      data.key,
      new PrivateMetadata({
        data: data.map.root,
        kind: MinaNFT.stringToField("map"),
        isPrivate: data.isPrivate ?? false,
        linkedObject: data.map,
      })
    );
  }

  /**
   * updates PrivateMetadata
   * @param data {@link MinaNFTImageUpdate} update data
   */
  public async updateImage(data: MinaNFTImageUpdate): Promise<void> {
    const file = new File(data.filename);
    console.log("Pinning image to IPFS...");
    await file.pin(data.pinataJWT);
    console.log("Calculating image Merkle tree root...");
    console.time("Image Merkle tree root calculated");
    await file.treeData();
    console.timeEnd("Image Merkle tree root calculated");
    console.time("Calculated SHA-3 512");
    await file.sha3_512();
    console.timeEnd("Calculated SHA-3 512");
    const fileData: FileData = await file.data();
    this.updateFileData("image", "image", fileData, false);
    /*
    this.updateMetadata(
      "image",
      new PrivateMetadata({
        data: fileData.root,
        kind: MinaNFT.stringToField("image"),
        isPrivate: false,
        linkedObject: fileData,
      })
    );
*/
  }

  /**
   * updates PrivateMetadata
   * @param data {@link MinaNFTFileUpdate} update data
   */
  public async updateFile(data: MinaNFTFileUpdate): Promise<void> {
    const file = new File(data.filename);
    console.log("Pinning file to IPFS...");
    await file.pin(data.pinataJWT);
    console.log("Calculating file Merkle tree root...");
    console.time("File Merkle tree root calculated");
    await file.treeData();
    console.timeEnd("File Merkle tree root calculated");
    console.time("Calculated SHA-3 512");
    await file.sha3_512();
    console.timeEnd("Calculated SHA-3 512");
    const fileData: FileData = await file.data();
    this.updateFileData(data.key, "file", fileData, data.isPrivate ?? false);
    /*
    this.updateMetadata(
      data.key,
      new PrivateMetadata({
        data: fileData.root,
        kind: MinaNFT.stringToField("file"),
        isPrivate: data.isPrivate ?? false,
        linkedObject: fileData,
      })
    );
*/
  }

  /**
   * updates PrivateMetadata
   * @param key key to update
   * @param type type of metadata ('file' or 'image' for example)
   * @param data {@link FileData} file data
   * @param isPrivate is metadata private
   */
  public updateFileData(
    key: string,
    type: string,
    data: FileData,
    isPrivate: boolean
  ): void {
    this.updateMetadata(
      key,
      new PrivateMetadata({
        data: data.root,
        kind: MinaNFT.stringToField(type),
        isPrivate: isPrivate,
        linkedObject: data,
      })
    );
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
  public async checkState(info: string = ""): Promise<boolean> {
    //console.log("Checking state for", this.name, "at", info);
    if (this.address === undefined)
      throw new Error("NFT contract is not deployed");

    if (this.nameService === undefined)
      throw new Error("Names contract address is undefined");

    const address: PublicKey = this.address;
    const nameService = new MinaNFTNameServiceContract(this.nameService);
    const tokenId = nameService.token.id;
    await fetchAccount({ publicKey: address, tokenId });
    if (!Mina.hasAccount(address, tokenId)) {
      console.error("NFT contract is not deployed");
      return false;
    }
    const zkApp = new MinaNFTContract(address, tokenId);
    let result = true;

    const version: UInt64 = zkApp.version.get();
    //console.log("Version:", this.name, info, version.toString());
    if (version.toBigInt().valueOf() !== this.version.toBigInt().valueOf()) {
      console.error("Version mismatch");
      result = false;
    }
    //console.log("After version:", this.name, info, version.toString());
    const oldEscrow = zkApp.escrow.get();
    if (oldEscrow.toBigInt().valueOf() !== this.escrow.toBigInt().valueOf()) {
      console.error("Escrow mismatch");
      result = false;
    }
    const oldOwner = zkApp.owner.get();
    if (oldOwner.toBigInt().valueOf() !== this.owner.toBigInt().valueOf()) {
      console.error("Owner mismatch");
      result = false;
    }
    const oldMetadata = zkApp.metadata.get();
    if (
      oldMetadata.data.toBigInt().valueOf() !==
      this.metadataRoot.data.toBigInt().valueOf()
    ) {
      console.error("Metadata data mismatch");
      result = false;
    }
    if (
      oldMetadata.kind.toBigInt().valueOf() !==
      this.metadataRoot.kind.toBigInt().valueOf()
    ) {
      console.error("Metadata kind mismatch");
      result = false;
    }

    const oldStorage = zkApp.storage.get();
    const storage: string = MinaNFT.stringFromFields(oldStorage.toFields());
    if (this.storage !== storage) {
      throw new Error("Storage mismatch");
    }

    const name = zkApp.name.get();
    if (MinaNFT.stringFromField(name) !== this.name) {
      console.error("Name mismatch");
      result = false;
    }
    if (result === false)
      console.error("State verification error for", this.name, "at", info);
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
    commitData: MinaNFTCommit
  ): Promise<Mina.TransactionId | undefined> {
    const {
      deployer,
      ownerPrivateKey,
      pinataJWT,
      nameService,
      nonce: nonceArg,
    } = commitData;

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

    if (nameService === undefined)
      throw new Error("Names Service is undefined");
    if (nameService.address === undefined)
      throw new Error("Names service address is undefined");

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
    const logMsg = `Update proofs created for ${
      this.name
    } version ${this.version.toString()}`;
    console.time(logMsg);
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

    //console.time("Update proof verified");
    const verificationResult: boolean = await verify(
      proof.toJSON(),
      MinaNFT.updateVerificationKey
    );
    //console.timeEnd("Update proof verified");
    console.timeEnd(logMsg);
    //console.log("Proof verification result:", verificationResult);
    if (verificationResult === false) {
      throw new Error("Proof verification error");
    }

    const storage = await this.pinToStorage(pinataJWT);
    if (storage === undefined) {
      throw new Error("IPFS Storage error");
    }
    const storageHash: Storage = storage.hash;

    if (false === (await this.checkState("commit"))) {
      throw new Error("State verification error");
    }

    //console.log("Commiting updates to blockchain...");
    const sender = deployer.toPublicKey();
    const zkApp = new MinaNFTNameServiceContract(nameService.address);
    const tokenId = zkApp.token.id;
    const zkAppNFT = new MinaNFTContract(address, tokenId);
    await fetchAccount({ publicKey: this.address, tokenId });
    await fetchAccount({ publicKey: nameService.address });
    await fetchAccount({ publicKey: sender });
    const hasAccount = Mina.hasAccount(this.address, tokenId);
    if (!hasAccount) throw new Error("NFT is not deployed, no account");
    const account = Account(sender);
    const nonce: number = nonceArg ?? Number(account.nonce.get().toBigint());
    const version: UInt64 = zkAppNFT.version.get();
    const newVersion: UInt64 = version.add(UInt64.from(1));
    const oldOwner = zkAppNFT.owner.get();
    const ownerPublicKey = ownerPrivateKey.toPublicKey();
    const owner = Poseidon.hash(ownerPublicKey.toFields());
    if (oldOwner.equals(owner).toBoolean() === false) {
      throw new Error("Owner privateKey mismatch");
    }

    const update: Update = new Update({
      oldRoot: proof.publicInput.oldRoot,
      newRoot: proof.publicInput.newRoot,
      storage: storageHash,
      verifier: nameService.address,
      version: newVersion,
      name: MinaNFT.stringToField(this.name),
      owner,
    });
    const signature = Signature.create(ownerPrivateKey, update.toFields());

    //console.log("Sending update...");
    const tx = await Mina.transaction(
      { sender, fee: await MinaNFT.fee(), memo: "minanft.io", nonce },
      () => {
        zkApp.update(address, update, signature, ownerPublicKey, proof!);
      }
    );
    let sentTx: Mina.TransactionId | undefined = undefined;
    try {
      await tx.prove();
      tx.sign([deployer]);
      console.time("Update transaction sent");
      sentTx = await tx.send();
      console.timeEnd("Update transaction sent");
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
      this.storage = storage.hashStr;
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
  private async pinToStorage(
    pinataJWT: string
  ): Promise<{ hash: Storage; hashStr: string } | undefined> {
    console.log("Pinning to IPFS...");
    const ipfs = new IPFS(pinataJWT);
    const hash = await ipfs.pinString(
      this.exportToString({ increaseVersion: true, includePrivateData: false })
    );
    if (hash === undefined) return undefined;
    const hashStr = "i:" + hash;
    const ipfs_fields = MinaNFT.stringToFields(hashStr);
    if (ipfs_fields.length !== 2) throw new Error("IPFS hash encoding error");
    return {
      hash: new Storage({ hashString: ipfs_fields as [Field, Field] }),
      hashStr,
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
      // We're on Berkeley or TestWorld2
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
          await tx.wait({ maxAttempts: 120, interval: 30 * 1000 }); //one hour
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
        await tx.wait({ maxAttempts: 120, interval: 30 * 1000 }); //one hour
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
   * @param minaData: {@link MinaNFTMint} mint data
   * @param skipCalculatingMetadataRoot: skip calculating metadata root in case the NFT is imported from the JSON that do not contains private metadata and therefore the root cannot be calculated
   */
  public async mint(
    minaData: MinaNFTMint,
    skipCalculatingMetadataRoot: boolean = false
  ): Promise<Mina.TransactionId | undefined> {
    const {
      nameService,
      deployer,
      owner: ownerArg,
      pinataJWT,
      privateKey,
      escrow: escrowArg,
      nonce: nonceArg,
    } = minaData;
    if (nameService === undefined)
      throw new Error("Names service is undefined");
    const escrow: Field = escrowArg ?? Field(0);
    const owner: Field = ownerArg ?? this.owner;
    if (owner.toJSON() === Field(0).toJSON())
      throw new Error("Owner is not defined");
    if (nameService.address === undefined)
      throw new Error("Names service address is undefined");
    await MinaNFT.compile();
    if (MinaNFT.verificationKey === undefined)
      throw new Error("Compilation error");
    const verificationKey: VerificationKey = MinaNFT.verificationKey;
    //console.log("Minting NFT...");
    const sender = deployer.toPublicKey();
    const zkAppPrivateKey = privateKey ?? PrivateKey.random();
    this.address = zkAppPrivateKey.toPublicKey();
    //const zkApp = new MinaNFTContract(this.address);

    const root = skipCalculatingMetadataRoot
      ? this.metadataRoot
      : this.getMetadataRootAndMap().root;
    const storage = await this.pinToStorage(pinataJWT);
    if (storage === undefined) {
      console.error("IPFS Storage error");
      return undefined;
    }
    const storageHash: Storage = storage.hash;
    //const url = "https://minanft.io/" + this.name;
    const name = MinaNFT.stringToField(this.name);
    /*
        class MinaNFTContract extends SmartContract {
              @state(Field) name = State<Field>();
              @state(Metadata) metadata = State<Metadata>();
              @state(Storage) storage = State<Storage>();
              @state(Field) owner = State<Field>();
              @state(Field) escrow = State<Field>();
              @state(UInt64) version = State<UInt64>();
    */

    const nft = new NFTMintData({
      name,
      address: this.address,
      initialState: [
        name,
        root.data, // metadata.data,
        root.kind, // metadata.kind,
        storageHash.hashString[0],
        storageHash.hashString[1],
        owner,
        escrow,
        Field.from(1), //version
      ],
      verifier: nameService.address,
    });
    const signature = await nameService.issueNameSignature(
      nft,
      verificationKey.hash
    );
    const mintData: MintData = new MintData({
      nft,
      verificationKey,
      signature,
    });

    const zkApp = new MinaNFTNameServiceContract(nameService.address);
    const tokenId = zkApp.token.id;
    this.tokenId = tokenId;

    await fetchAccount({ publicKey: this.address, tokenId });
    await fetchAccount({ publicKey: nameService.address });
    await fetchAccount({ publicKey: sender });
    const account = Account(sender);
    const nonce: number = nonceArg ?? Number(account.nonce.get().toBigint());
    const hasAccount = Mina.hasAccount(this.address, tokenId);

    const transaction = await Mina.transaction(
      { sender, fee: await MinaNFT.fee(), memo: "minanft.io", nonce },
      () => {
        if (!hasAccount) AccountUpdate.fundNewAccount(sender);
        zkApp.mint(mintData);
      }
    );
    await transaction.prove();
    transaction.sign([deployer, zkAppPrivateKey]);
    const sentTx = await transaction.send();
    await MinaNFT.transactionInfo(sentTx, "mint", false);
    if (sentTx.isSuccess) {
      this.isMinted = true;
      this.metadataRoot = root;
      this.storage = storage.hashStr;
      this.owner = owner;
      this.escrow = escrow;
      this.version = UInt64.from(1);
      this.nameService = nameService.address;
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
    transferData: MinaNFTTransfer
  ): Promise<Mina.TransactionId | undefined> {
    const {
      deployer,
      data,
      signature1,
      signature2,
      signature3,
      escrow1,
      escrow2,
      escrow3,
      nameService,
      nonce: nonceArg,
    } = transferData;
    if (this.address === undefined) {
      throw new Error("NFT contract is not deployed");
      return;
    }
    const address: PublicKey = this.address;
    if (this.isMinted === false) {
      throw new Error("NFT is not minted");
      return undefined;
    }

    if (nameService === undefined)
      throw new Error("Names service is undefined");
    if (nameService.address === undefined)
      throw new Error("Names service address is undefined");

    await MinaNFT.compile();
    if (MinaNFT.verificationKey === undefined) {
      throw new Error("Compilation error");
      return undefined;
    }

    //console.log("Transferring NFT...");
    this.nameService = nameService.address;
    if (false === (await this.checkState("transfer"))) {
      throw new Error("State verification error");
    }
    const sender = deployer.toPublicKey();
    const zkApp = new MinaNFTNameServiceContract(nameService.address);
    const tokenId = zkApp.token.id;
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: address, tokenId });
    await fetchAccount({ publicKey: sender });
    const account = Account(sender);
    const nonce: number = nonceArg ?? Number(account.nonce.get().toBigint());
    if (!Mina.hasAccount(address, tokenId))
      throw new Error("NFT is not deployed, no account exists");
    const tx = await Mina.transaction(
      { sender, fee: await MinaNFT.fee(), memo: "minanft.io", nonce },
      () => {
        zkApp.transfer(
          address,
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
    aprovalData: MinaNFTApproval
  ): Promise<Mina.TransactionId | undefined> {
    const {
      deployer,
      data,
      signature,
      ownerPublicKey,
      nameService,
      nonce: nonceArg,
    } = aprovalData;
    if (this.address === undefined) {
      throw new Error("NFT contract is not deployed");
      return;
    }
    const address: PublicKey = this.address;

    if (this.isMinted === false) {
      throw new Error("NFT is not minted");
      return undefined;
    }

    if (nameService === undefined)
      throw new Error("Names service is undefined");

    if (nameService.address === undefined)
      throw new Error("Names service address is undefined");

    await MinaNFT.compile();
    if (MinaNFT.verificationKey === undefined) {
      throw new Error("Compilation error");
      return undefined;
    }

    this.nameService = nameService.address;
    if (false === (await this.checkState("approve"))) {
      throw new Error("State verification error");
    }
    const sender = deployer.toPublicKey();
    const zkApp = new MinaNFTNameServiceContract(nameService.address);
    const tokenId = zkApp.token.id;
    await fetchAccount({ publicKey: nameService.address });
    await fetchAccount({ publicKey: address, tokenId });
    await fetchAccount({ publicKey: sender });
    const account = Account(sender);
    const nonce: number = nonceArg ?? Number(account.nonce.get().toBigint());
    const tx = await Mina.transaction(
      { sender, fee: await MinaNFT.fee(), memo: "minanft.io", nonce },
      () => {
        zkApp.approveEscrow(address, data, signature, ownerPublicKey);
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
    tokenId: Field,
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
        zkApp.verifyRedactedMetadata(address, tokenId, proof);
      }
    );
    await tx.prove();
    tx.sign([deployer]);
    const res = await tx.send();
    await MinaNFT.transactionInfo(res);
  }
}
