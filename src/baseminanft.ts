export { BaseMinaNFT };
import { Field, Cache, VerificationKey, Encoding } from "o1js";
import { MinaNFT } from "./minanft";
import { MinaNFTContract } from "./contract/nft";
import { MinaNFTNameServiceContract } from "./contract/names";
import { Metadata, MetadataWitness } from "./contract/metadata";
import {
  MinaNFTMetadataUpdate,
  MetadataUpdate,
  MetadataMap,
} from "./contract/update";
import { RedactedMinaNFTMapCalculation } from "./plugins/redactedmap";
import { MinaNFTVerifier } from "./plugins/verifier";
import { MinaNFTVerifierBadge } from "./plugins/badge";
import { MinaNFTBadgeCalculation } from "./plugins/badgeproof";
import { Escrow } from "./plugins/escrow";
import { PrivateMetadata } from "./privatemetadata";

// Dummy class to ovecome o1js compile bug - fixed now
/*
class Key extends SmartContract {
  @state(Field) key = State<Field>();

  @method mint(key: Field) {
    this.key.assertEquals(Field(0));
    this.key.set(key);
  }
}
*/

/**
 * Base class for MinaNFT
 */
class BaseMinaNFT {
  metadata: Map<string, PrivateMetadata>;
  static verificationKey: VerificationKey | undefined;
  static namesVerificationKey: VerificationKey | undefined;
  static updaterVerificationKey: VerificationKey | undefined;
  static updateVerificationKey: VerificationKey | undefined;
  static verifierVerificationKey: VerificationKey | undefined;
  static redactedMapVerificationKey: VerificationKey | undefined;
  static badgeVerifierVerificationKey: VerificationKey | undefined;
  static badgeVerificationKey: VerificationKey | undefined;
  static escrowVerificationKey: VerificationKey | undefined;
  static cache: Cache | undefined;

  constructor() {
    this.metadata = new Map<string, PrivateMetadata>();
  }

  /**
   * Gets public attribute
   * @param key key of the attribute
   * @returns value of the attribute
   */
  public getMetadata(key: string): PrivateMetadata | undefined {
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
    newValue: PrivateMetadata
  ): MetadataUpdate {
    const { root, map } = this.getMetadataRootAndMap();
    const key = MinaNFT.stringToField(keyToUpdate);
    const witness: MetadataWitness = map.getWitness(key);
    const oldValue: Metadata = map.get(key);
    this.metadata.set(keyToUpdate, newValue);
    map.set(key, new Metadata({ data: newValue.data, kind: newValue.kind }));
    const newRoot: Metadata = map.getRoot();

    return new MetadataUpdate({
      oldRoot: root,
      newRoot,
      key,
      oldValue,
      newValue: new Metadata({ data: newValue.data, kind: newValue.kind }),
      witness,
    });
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
  protected getMapRootAndMap(data: Map<string, PrivateMetadata>): {
    root: Metadata;
    map: MetadataMap;
  } {
    const map: MetadataMap = new MetadataMap();
    data.forEach((value: PrivateMetadata, key: string) => {
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
    //const fields: Field[] = stringToFields(item);
    if (fields.length === 1) {
      if (MinaNFT.stringFromFields(fields) === item) return fields[0];
      else throw Error(`stringToField error: encoding error`);
    } else
      throw new Error(
        `stringToField error: string ${item} is too long, requires ${fields.length} Fields`
      );
  }

  /**
   * Converts a string to a Fields
   * @param item string to convert
   * @returns string as a Field[]
   */
  public static stringToFields(item: string): Field[] {
    const fields: Field[] = Encoding.stringToFields(item);
    //const fields: Field[] = stringToFields(item);
    if (MinaNFT.stringFromFields(fields) === item) return fields;
    else throw Error(`stringToField error: encoding error`);
  }

  /**
   * Converts a Field to a string
   * @param field Field to convert
   * @returns string
   */
  public static stringFromField(field: Field): string {
    return MinaNFT.stringFromFields([field]);
  }

  /**
   * Converts a Field[] to a string
   * @param fields Fields to convert
   * @returns string
   */
  public static stringFromFields(fields: Field[]): string {
    // Encoding.stringFromFields is not working properly in o1js 0.14.0, use internal implementation
    // It is working again in o1js 0.14.1
    return Encoding.stringFromFields(fields);
  }

  /**
   * Converts a string "i:..." or "a:..." to a storage url string
   * @param str string to convert
   * @returns string
   */
  public static urlFromStorageString(storageStr: string): string {
    if (
      storageStr.length < 2 ||
      (storageStr[0] !== "i" && storageStr[0] !== "a")
    ) {
      throw new Error("Invalid storage string");
    }
    const url: string =
      storageStr[0] === "i"
        ? "https://gateway.pinata.cloud/ipfs/" + storageStr.slice(2)
        : "https://arweave.net/" + storageStr.slice(2);
    return url;
  }

  /**
   * Converts a Storage to a storage url string
   * @param stirage Storage to convert
   * @returns string
   */
  public static urlFromStorage(storage: Storage): string {
    return BaseMinaNFT.urlFromStorageString(
      Encoding.stringFromFields(storage.hashString)
    );
  }

  /**
   * Sets a cache for prover keys
   */
  public static setCache(cache: Cache): void {
    MinaNFT.cache = cache;
  }

  /**
   * Sets a cache folder for prover keys
   * @param folder folder for prover keys
   * default is "./nftcache"
   */
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  public static setCacheFolder(folder: string = "./nftcache"): void {
    MinaNFT.cache = Cache.FileSystem(folder);
  }

  /**
   * Compiles MinaNFT contract
   * @returns verification key
   */
  public static async compile(): Promise<VerificationKey> {
    const options = MinaNFT.cache ? { cache: MinaNFT.cache } : undefined;

    if (MinaNFT.updateVerificationKey === undefined) {
      console.time("MinaNFTMetadataUpdate compiled");
      //await Key.compile(options);
      const { verificationKey } = await MinaNFTMetadataUpdate.compile(options);
      console.timeEnd("MinaNFTMetadataUpdate compiled");
      MinaNFT.updateVerificationKey = verificationKey;
    }

    if (MinaNFT.verificationKey == undefined) {
      console.time("MinaNFT compiled");
      const { verificationKey } = await MinaNFTContract.compile(options);
      console.timeEnd("MinaNFT compiled");
      MinaNFT.verificationKey = verificationKey as VerificationKey;
    }

    if (MinaNFT.namesVerificationKey == undefined) {
      console.time("MinaNFTNameServiceContract compiled");
      const { verificationKey } =
        await MinaNFTNameServiceContract.compile(options);
      console.timeEnd("MinaNFTNameServiceContract compiled");
      MinaNFT.namesVerificationKey = verificationKey as VerificationKey;
    }

    return MinaNFT.verificationKey;
  }

  /**
   * Compiles MinaNFTVerifier contract
   * @returns verification key
   */
  public static async compileVerifier(): Promise<VerificationKey> {
    const options = MinaNFT.cache ? { cache: MinaNFT.cache } : undefined;
    if (MinaNFT.redactedMapVerificationKey === undefined) {
      console.time("RedactedMinaNFTMapCalculation compiled");
      const { verificationKey } =
        await RedactedMinaNFTMapCalculation.compile(options);
      console.timeEnd("RedactedMinaNFTMapCalculation compiled");
      MinaNFT.redactedMapVerificationKey = verificationKey;
    }
    if (MinaNFT.verifierVerificationKey === undefined) {
      console.time("MinaNFTVerifier compiled");
      const { verificationKey } = await MinaNFTVerifier.compile(options);
      console.timeEnd("MinaNFTVerifier compiled");
      MinaNFT.verifierVerificationKey = verificationKey as VerificationKey;
    }
    return MinaNFT.verifierVerificationKey;
  }

  /**
   * Compiles MinaNFTVerifierBadge contract
   * @returns verification key
   */
  public static async compileBadge(): Promise<VerificationKey> {
    const options = MinaNFT.cache ? { cache: MinaNFT.cache } : undefined;
    if (MinaNFT.redactedMapVerificationKey === undefined) {
      console.time("RedactedMinaNFTMapCalculation compiled");
      const { verificationKey } =
        await RedactedMinaNFTMapCalculation.compile(options);
      console.timeEnd("RedactedMinaNFTMapCalculation compiled");
      MinaNFT.redactedMapVerificationKey = verificationKey;
    }
    if (MinaNFT.badgeVerificationKey === undefined) {
      console.time("MinaNFTBadgeCalculation compiled");
      const { verificationKey } =
        await MinaNFTBadgeCalculation.compile(options);
      console.timeEnd("MinaNFTBadgeCalculation compiled");
      MinaNFT.badgeVerificationKey = verificationKey;
    }
    if (MinaNFT.badgeVerifierVerificationKey === undefined) {
      console.time("MinaNFTVerifierBadge compiled");
      const { verificationKey } = await MinaNFTVerifierBadge.compile(options);
      console.timeEnd("MinaNFTVerifierBadge compiled");
      MinaNFT.badgeVerifierVerificationKey = verificationKey as VerificationKey;
    }
    return MinaNFT.badgeVerifierVerificationKey;
  }

  /**
   * Compiles Escrow contract
   * @returns verification key
   */
  public static async compileEscrow(): Promise<VerificationKey> {
    const options = MinaNFT.cache ? { cache: MinaNFT.cache } : undefined;
    if (MinaNFT.escrowVerificationKey === undefined) {
      console.time("Escrow compiled");
      const { verificationKey } = await Escrow.compile(options);
      console.timeEnd("Escrow compiled");
      MinaNFT.escrowVerificationKey = verificationKey as VerificationKey;
    }
    return MinaNFT.escrowVerificationKey;
  }

  /**
   * Compiles RedactedMinaNFTMapCalculation contract
   * @returns verification key
   */
  public static async compileRedactedMap(): Promise<VerificationKey> {
    const options = MinaNFT.cache ? { cache: MinaNFT.cache } : undefined;
    if (MinaNFT.redactedMapVerificationKey === undefined) {
      console.time("RedactedMinaNFTMapCalculation compiled");
      const { verificationKey } =
        await RedactedMinaNFTMapCalculation.compile(options);
      console.timeEnd("RedactedMinaNFTMapCalculation compiled");
      MinaNFT.redactedMapVerificationKey = verificationKey;
    }
    return MinaNFT.redactedMapVerificationKey;
  }
}
