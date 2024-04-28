import { Field, verify, Struct, VerificationKey, PublicKey } from "o1js";
import axios from "axios";
import { MinaNFT } from "./minanft";
import { BaseMinaNFT } from "./baseminanft";
import { PrivateMetadata } from "./privatemetadata";
import { Metadata, Storage } from "./contract/metadata";
import {
  MinaNFTMetadataUpdate,
  MetadataTransition,
  MetadataUpdate,
  MetadataMap,
  MinaNFTMetadataUpdateProof,
} from "./contract/update";
import { serializeFields, deserializeFields } from "./lib/fields";

import { TextData } from "./storage/text";
import { File, FileData } from "./storage/file";
import { MinaNFTMapUpdate } from "./storage/map";
import { IPFS } from "./storage/ipfs";
import { ARWEAVE } from "./storage/arweave";
import {
  MinaNFTStringUpdate,
  MinaNFTFieldUpdate,
  MinaNFTImageUpdate,
  MinaNFTTextUpdate,
  MinaNFTFileUpdate,
  MinaNFTCommit,
  MinaNFTPrepareCommit,
  RollupNFTCommit,
  RollupNFTCommitData,
} from "./update";
import { MapData } from "./storage/map";
import { sleep } from "./mina";

/**
 * RollupUpdate is the data for the update of the metadata to be written to the NFT state
 * @property oldRoot The old root of the Merkle Map of the metadata
 * @property newRoot The new root of the Merkle Map of the metadata
 * @property storage The storage of the NFT - IPFS (i:...) or Arweave (a:...) hash string
 */
export class RollupUpdate extends Struct({
  oldRoot: Metadata,
  newRoot: Metadata,
  storage: Storage,
}) {
  constructor(value: {
    oldRoot: Metadata;
    newRoot: Metadata;
    storage: Storage;
  }) {
    super(value);
  }
}
/**
 * RollupNFT are the NFT used in the Rollup
 * TODO: change parameters
 * @property name Name of the NFT
 * @property creator Creator of the NFT
 * @property storage Storage of the NFT - IPFS (i:...) or Arweave (a:...) hash string
 * @property owner Owner of the NFT - Poseidon hash of owner's public key
 * @property escrow Escrow of the NFT - Poseidon hash of three escrow's public keys
 * @property version Version of the NFT, increases by one with the changing of the metadata or owner
 * @property isMinted True if the NFT is minted
 * @property address Public key of the deployed NFT zkApp
 * @property tokenId Token ID of the NFT Name Service
 * @property nameService Public key of the NFT Name Service
 * @property updates Array of the metadata updates
 * @property metadataRoot Root of the Merkle Map of the metadata
 */
export class RollupNFT extends BaseMinaNFT {
  storage: Storage | undefined;
  metadataRoot: Metadata;
  isSomeMetadata: boolean = false;
  private updates: MetadataUpdate[] = [];
  name?: string;
  address?: PublicKey;
  external_url?: string;

  /**
   * Create MinaNFT object
   * @param params arguments
   * @param params.name Name of NFT
   * @param params.address Public key of the deployed NFT zkApp
   * @param params.creator Creator of the NFT
   * @param params.storage Storage of the NFT - IPFS (i:...) or Arweave (a:...) hash string
   * @param params.owner Owner of the NFT - Poseidon hash of owner's public key
   * @param params.escrow Escrow of the NFT - Poseidon hash of three escrow's public keys
   * @param params.nameService Public key of the NFT Name Service
   */
  constructor(
    params: {
      storage?: Storage;
      root?: Metadata;
      name?: string;
      address?: PublicKey | string;
      external_url?: string;
    } = {}
  ) {
    const { storage, root, name, address, external_url } = params;
    super();
    const metadataMap = new MetadataMap();
    if (root !== undefined) {
      this.metadataRoot = root;
      this.isSomeMetadata = true;
    } else this.metadataRoot = metadataMap.getRoot();
    this.storage = storage;
    this.name = name;
    this.external_url = external_url;
    if (address !== undefined)
      this.address =
        typeof address === "string" ? PublicKey.fromBase58(address) : address;
  }

  /**
   * Compiles RollupNFT MetadataUpdate contract
   * @returns verification key
   */
  public static async compile(): Promise<VerificationKey> {
    return BaseMinaNFT.compile(true);
  }

  /**
   * Load metadata from blockchain and IPFS/Arweave
   * @param metadataURI URI of the metadata. Obligatorily in case there is private metadata as private metadata cannot be fetched from IPFS/Arweave
   * @param skipCalculatingMetadataRoot Skip calculating metadata root in case metadataURI is not provided and NFT contains private data
   */
  public async loadMetadata(
    metadataURI: string | undefined = undefined,
    skipCalculatingMetadataRoot: boolean = false
  ): Promise<void> {
    const uri = metadataURI
      ? JSON.parse(metadataURI)
      : this.storage
      ? (
          await axios.get(
            "https://gateway.pinata.cloud/ipfs/" + this.storage.toIpfsHash()
          )
        ).data
      : undefined;
    if (uri === undefined) throw new Error("uri: NFT metadata not found");

    if (this.isSomeMetadata) {
      if (uri.metadata.data !== this.metadataRoot.data.toJSON())
        throw new Error("uri: NFT metadata data mismatch");
      if (uri.metadata.kind !== this.metadataRoot.kind.toJSON())
        throw new Error("uri: NFT metadata kind mismatch");
    } else {
      this.metadataRoot = new Metadata({
        data: Field.fromJSON(uri.metadata.data),
        kind: Field.fromJSON(uri.metadata.kind),
      });
      this.isSomeMetadata = true;
    }
    this.name = uri.name;
    this.address =
      uri.address && typeof uri.address === "string"
        ? PublicKey.fromBase58(uri.address)
        : undefined;
    this.external_url = uri.external_url;

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
              linkedObject: MapData.fromJSON(obj, skipCalculatingMetadataRoot),
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

    if (skipCalculatingMetadataRoot === false) {
      const { root } = this.getMetadataRootAndMap();
      if (root.data.toJSON() !== this.metadataRoot.data.toJSON())
        throw new Error("Metadata root data mismatch");
      if (root.kind.toJSON() !== this.metadataRoot.kind.toJSON())
        throw new Error("Metadata root kind mismatch");
      this.isSomeMetadata = true;
    }
  }

  /**
   * Creates a Map from JSON
   * @param json json with map data
   * @returns map as JSON object
   */
  public static mapFromJSON(json: object): Map<string, string> {
    const map: Map<string, string> = new Map<string, string>();
    Object.entries(json).forEach(([key, value]) => map.set(key, value));
    return map;
  }

  /**
   * Converts to JSON
   * @returns JSON object
   */
  public toJSON(params: { includePrivateData?: boolean } = {}): object {
    const includePrivateData = params.includePrivateData ?? false;
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
      imageObject.linkedObject instanceof FileData &&
      imageObject.linkedObject.storage !== undefined &&
      imageObject.linkedObject.storage.length > 2
    )
      image =
        imageObject.linkedObject.storage[0] === "i"
          ? "https://gateway.pinata.cloud/ipfs/" +
            imageObject.linkedObject.storage.slice(2)
          : "https://arweave.net/" + imageObject.linkedObject.storage.slice(2);

    const { root } = this.getMetadataRootAndMap();

    const json = {
      name: this.name,
      address: this.address?.toBase58(),
      description: description,
      image,
      external_url: this.external_url ?? this.getURL(),
      uri: this.storage
        ? "https://gateway.pinata.cloud/ipfs/" + this.storage.toIpfsHash()
        : undefined,
      storage: this.storage?.toString(),
      time: Date.now(),
      metadata: { data: root.data.toJSON(), kind: root.kind.toJSON() },
      properties: Object.fromEntries(this.metadata),
    };
    return includePrivateData
      ? JSON.parse(JSON.stringify(json))
      : JSON.parse(
          JSON.stringify(json, (_, value) =>
            value?.isPrivate === true ? undefined : value
          )
        );
  }

  /**
   * updates Metadata
   * @param key key to update
   * @param value value to update
   */
  public updateMetadata(key: string, value: PrivateMetadata): void {
    const update: MetadataUpdate = this.updateMetadataMap(key, value);
    this.updates.push(update);
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
    const file = new File(data.filename, data.fileType, data.fileMetadata);
    if (data.IPFSHash === undefined && data.ArweaveHash === undefined) {
      console.log("Pinning image...");
      await file.pin({
        pinataJWT: data.pinataJWT,
        arweaveKey: data.arweaveKey,
        keyvalues: { project: "MinaNFT", type: "image", nftType: "RollupNFT" },
      });
    } else if (data.IPFSHash !== undefined) {
      file.storage = "i:" + data.IPFSHash;
      await file.setMetadata();
    } else if (data.ArweaveHash !== undefined) {
      file.storage = "a:" + data.ArweaveHash;
      await file.setMetadata();
    }
    if (data.calculateRoot !== false) {
      console.log("Calculating image Merkle tree root...");
      console.time("Image Merkle tree root calculated");
      await file.treeData(data.calculateRoot ?? true);
      console.timeEnd("Image Merkle tree root calculated");
    } else await file.treeData(false);
    console.time("Calculated SHA-3 512");
    await file.sha3_512();
    console.timeEnd("Calculated SHA-3 512");
    const fileData: FileData = await file.data();
    this.updateFileData({
      key: "image",
      type: "image",
      data: fileData,
      isPrivate: false,
    });
  }

  /**
   * updates PrivateMetadata
   * @param data {@link MinaNFTFileUpdate} update data
   */
  public async updateFile(data: MinaNFTFileUpdate): Promise<void> {
    const file = new File(data.filename, data.fileType, data.fileMetadata);

    if (data.IPFSHash === undefined && data.ArweaveHash === undefined) {
      if (data.isPrivate !== true) {
        console.log("Pinning file...");
        await file.pin({
          pinataJWT: data.pinataJWT,
          arweaveKey: data.arweaveKey,
          keyvalues: { project: "MinaNFT", type: "file", nftType: "RollupNFT" },
        });
      }
    } else if (data.IPFSHash !== undefined) {
      file.storage = "i:" + data.IPFSHash;
      await file.setMetadata();
    } else if (data.ArweaveHash !== undefined) {
      file.storage = "a:" + data.ArweaveHash;
      await file.setMetadata();
    }
    if (data.calculateRoot !== false) {
      console.log("Calculating file Merkle tree root...");
      console.time("File Merkle tree root calculated");
      await file.treeData(data.calculateRoot ?? true);
      console.timeEnd("File Merkle tree root calculated");
    } else await file.treeData(false);

    console.time("Calculated SHA-3 512");
    await file.sha3_512();
    console.timeEnd("Calculated SHA-3 512");
    const fileData: FileData = await file.data();
    this.updateFileData({
      key: data.key,
      type: "file",
      data: fileData,
      isPrivate: data.isPrivate ?? false,
    });
  }

  /**
   * updates PrivateMetadata
   * @param params arguments
   * @param params.key key to update
   * @param params.type type of metadata ('file' or 'image' for example)
   * @param params.data {@link FileData} file data
   * @param params.isPrivate is metadata private
   */
  public updateFileData(params: {
    key: string;
    type?: string;
    data: FileData;
    isPrivate?: boolean;
  }): void {
    const { key, type, data, isPrivate } = params;
    this.updateMetadata(
      key,
      new PrivateMetadata({
        data: data.root,
        kind: MinaNFT.stringToField(type ?? "file"),
        isPrivate: isPrivate ?? false,
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
   * Prepare commit updates of the MinaNFT to blockchain
   *
   * @param commitData {@link MinaNFTPrepareCommit} commit data
   */
  public async prepareCommitData(
    commitData: RollupNFTCommit
  ): Promise<RollupNFTCommitData | undefined> {
    const { pinataJWT, arweaveKey, generateProofData } = commitData;

    if (this.updates.length === 0) {
      console.error("No updates to commit");
      return undefined;
    }

    const transactions = [];
    for (const update of this.updates) {
      const state: MetadataTransition = MetadataTransition.create(update);
      transactions.push({ state, update });
    }

    //console.log("Merging states...");
    let mergedState = transactions[0].state;
    for (let i = 1; i < transactions.length; i++) {
      const state: MetadataTransition = MetadataTransition.merge(
        mergedState,
        transactions[i].state
      );
      mergedState = state;
    }

    if (
      this.isSomeMetadata &&
      (this.metadataRoot.data.toJSON() !== mergedState.oldRoot.data.toJSON() ||
        this.metadataRoot.kind.toJSON() !== mergedState.oldRoot.kind.toJSON())
    )
      throw new Error("Metadata old root data mismatch");

    this.metadataRoot = mergedState.newRoot;
    const storage = await this.pinToStorage(pinataJWT, arweaveKey);
    if (storage === undefined) {
      throw new Error("Storage error");
    }
    this.storage = storage.hash;

    if (!generateProofData) return undefined;

    const update = new RollupUpdate({
      oldRoot: mergedState.oldRoot,
      newRoot: mergedState.newRoot,
      storage: this.storage,
    });

    const transactionsStr: string[] = transactions.map((t) =>
      JSON.stringify({
        state: serializeFields(MetadataTransition.toFields(t.state)),
        update: serializeFields(MetadataUpdate.toFields(t.update)),
      })
    );
    const updateStr: string = JSON.stringify({
      update: serializeFields(RollupUpdate.toFields(update)),
    });

    this.isSomeMetadata = true;

    return {
      update: updateStr,
      transactions: transactionsStr,
    };
  }

  public getURL(): string | undefined {
    if (this.storage === undefined) return undefined;
    return "https://minanft.io/nft/i" + this.storage.toIpfsHash();
  }

  /**
   * Commit updates of the MinaNFT to blockchain using prepared data
   * Generates recursive proofs for all updates,
   * than verify the proof locally and send the transaction to the blockchain
   *
   * @param generateProof {@link MinaNFTCommit} commit data
   */
  public static async generateProof(
    preparedCommitData: RollupNFTCommitData,
    verbose: boolean = false
  ): Promise<MinaNFTMetadataUpdateProof> {
    const { update: updateStr, transactions: transactionsStr } =
      preparedCommitData;

    const transactions = transactionsStr.map((t) => {
      const obj = JSON.parse(t);
      const state = MetadataTransition.fromFields(deserializeFields(obj.state));
      const update = MetadataUpdate.fromFields(deserializeFields(obj.update));
      return { state, update };
    });

    const update = RollupUpdate.fromFields(
      deserializeFields(JSON.parse(updateStr).update)
    );

    if (MinaNFT.updateVerificationKey === undefined) {
      throw new Error("generateProof: Update verification key is undefined");
    }

    console.log("Creating proofs...");
    const logMsg = `Update proofs created`;
    console.time(logMsg);
    let proofs: MinaNFTMetadataUpdateProof[] = [];
    let count = 1;
    for (const transaction of transactions) {
      if (verbose)
        console.log(`Creating proof ${count++}/${transactions.length}`);
      await sleep(100); // alow GC to run
      const proof: MinaNFTMetadataUpdateProof =
        await MinaNFTMetadataUpdate.update(
          transaction.state,
          transaction.update
        );
      proofs.push(proof);
    }

    console.log("Merging proofs...");
    let proof: MinaNFTMetadataUpdateProof = proofs[0];
    count = 1;
    for (let i = 1; i < proofs.length; i++) {
      if (verbose) console.log(`Merging proof ${count++}/${proofs.length - 1}`);
      await sleep(100); // alow GC to run
      const state: MetadataTransition = MetadataTransition.merge(
        proof.publicInput,
        proofs[i].publicInput
      );
      const mergedProof: MinaNFTMetadataUpdateProof =
        await MinaNFTMetadataUpdate.merge(state, proof, proofs[i]);
      proof = mergedProof;
    }

    console.time("Update proof verified");
    const verificationResult: boolean = await verify(
      proof.toJSON(),
      MinaNFT.updateVerificationKey
    );
    console.timeEnd("Update proof verified");
    console.timeEnd(logMsg);
    console.log("Proof verification result:", verificationResult);
    if (verificationResult === false) {
      throw new Error("Proof verification error");
    }

    return proof;
  }

  /**
   * Pins NFT to IPFS or Arweave
   * @param pinataJWT Pinata JWT
   * @param arweaveKey Arweave key
   * @returns NFT's storage hash and hash string
   */
  private async pinToStorage(
    pinataJWT: string | undefined,
    arweaveKey: string | undefined
  ): Promise<{ hash: Storage; hashStr: string } | undefined> {
    if (pinataJWT === undefined && arweaveKey === undefined) {
      throw new Error(
        "No storage service key provided. Provide pinateJWT or arweaveKey"
      );
    }
    if (pinataJWT !== undefined) {
      console.log("Pinning to IPFS...");
      const ipfs = new IPFS(pinataJWT);
      let hash = await ipfs.pinJSON({
        data: this.toJSON({
          includePrivateData: false,
        }),
        name: "rollup-nft.json",
        keyvalues: {
          project: "MinaNFT",
          type: "metadata",
          nftType: "RollupNFT",
        },
      });
      if (hash === undefined) {
        console.error("Pinning to IPFS failed. Retrying...");
        await sleep(10000);
        hash = await ipfs.pinJSON({
          data: this.toJSON({
            includePrivateData: false,
          }),
          name: "rollup-nft.json",
          keyvalues: {
            project: "MinaNFT",
            type: "metadata",
            nftType: "RollupNFT",
          },
        });
      }
      if (hash === undefined) {
        console.error("Pinning to IPFS failed");
        return undefined;
      }
      const hashStr = "i:" + hash;
      const ipfs_fields = MinaNFT.stringToFields(hashStr);
      if (ipfs_fields.length !== 2) throw new Error("IPFS hash encoding error");
      return {
        hash: new Storage({ hashString: ipfs_fields as [Field, Field] }),
        hashStr,
      };
    } else if (arweaveKey !== undefined) {
      console.log("Pinning to Arweave...");
      const arweave = new ARWEAVE(arweaveKey);
      const hash = await arweave.pinString(
        JSON.stringify(
          this.toJSON({
            includePrivateData: false,
          }),
          null,
          2
        )
      );
      if (hash === undefined) return undefined;
      const hashStr = "a:" + hash;
      const arweave_fields = MinaNFT.stringToFields(hashStr);
      if (arweave_fields.length !== 2)
        throw new Error("Arweave hash encoding error");
      return {
        hash: new Storage({ hashString: arweave_fields as [Field, Field] }),
        hashStr,
      };
    } else return undefined;
  }
}
