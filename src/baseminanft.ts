export { BaseMinaNFT };
import { Field, Encoding, Cache, VerificationKey } from "o1js";
import { MinaNFT } from "./minanft";
import { MinaNFTContract } from "./contract/nft";
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

class BaseMinaNFT {
  protected metadata: Map<string, Metadata>;
  static verificationKey: VerificationKey | undefined;
  static updaterVerificationKey: VerificationKey | undefined;
  static updateVerificationKey: string | undefined;
  static verifierVerificationKey: VerificationKey | undefined;
  static redactedMapVerificationKey: string | undefined;
  static badgeVerifierVerificationKey: VerificationKey | undefined;
  static badgeVerificationKey: string | undefined;

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
   * Converts a Field to a string
   * @param item Field to convert
   * @returns string
   */
  public static stringFromField(item: Field): string {
    return Encoding.stringFromFields([item]);
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
   * Compiles MinaNFT contract
   * @returns verification key
   */
  public static async compile(): Promise<VerificationKey> {
    if (MinaNFT.updateVerificationKey === undefined) {
      console.time("MinaNFTMetadataUpdate compiled");
      const { verificationKey } = await MinaNFTMetadataUpdate.compile();
      console.timeEnd("MinaNFTMetadataUpdate compiled");
      MinaNFT.updateVerificationKey = verificationKey;
    }

    if (MinaNFT.verificationKey !== undefined) {
      return MinaNFT.verificationKey;
    }
    const cache: Cache = Cache.FileSystem("./nftcache");
    console.time("MinaNFT compiled");
    const { verificationKey } = await MinaNFTContract.compile({ cache });
    console.timeEnd("MinaNFT compiled");
    MinaNFT.verificationKey = verificationKey as VerificationKey;
    return MinaNFT.verificationKey;
  }

  /**
   * Compiles MinaNFTVerifier contract
   * @returns verification key
   */
  public static async compileVerifier(): Promise<VerificationKey> {
    if (MinaNFT.redactedMapVerificationKey === undefined) {
      console.time("RedactedMinaNFTMapCalculation compiled");
      const { verificationKey } = await RedactedMinaNFTMapCalculation.compile();
      console.timeEnd("RedactedMinaNFTMapCalculation compiled");
      MinaNFT.redactedMapVerificationKey = verificationKey;
    }
    if (MinaNFT.verifierVerificationKey === undefined) {
      console.time("MinaNFTVerifier compiled");
      const { verificationKey } = await MinaNFTVerifier.compile();
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
    if (MinaNFT.redactedMapVerificationKey === undefined) {
      console.time("RedactedMinaNFTMapCalculation compiled");
      const { verificationKey } = await RedactedMinaNFTMapCalculation.compile();
      console.timeEnd("RedactedMinaNFTMapCalculation compiled");
      MinaNFT.redactedMapVerificationKey = verificationKey;
    }
    if (MinaNFT.badgeVerificationKey === undefined) {
      console.time("MinaNFTBadgeCalculation compiled");
      const { verificationKey } = await MinaNFTBadgeCalculation.compile();
      console.timeEnd("MinaNFTBadgeCalculation compiled");
      MinaNFT.badgeVerificationKey = verificationKey;
    }
    if (MinaNFT.badgeVerifierVerificationKey === undefined) {
      console.time("MinaNFTVerifierBadge compiled");
      const { verificationKey } = await MinaNFTVerifierBadge.compile();
      console.timeEnd("MinaNFTVerifierBadge compiled");
      MinaNFT.badgeVerifierVerificationKey = verificationKey as VerificationKey;
    }
    return MinaNFT.badgeVerifierVerificationKey;
  }

  /**
   * Compiles RedactedMinaNFTMapCalculation contract
   * @returns verification key
   */
  public static async compileRedactedMap(): Promise<string> {
    if (MinaNFT.redactedMapVerificationKey === undefined) {
      console.time("RedactedMinaNFTMapCalculation compiled");
      const { verificationKey } = await RedactedMinaNFTMapCalculation.compile();
      console.timeEnd("RedactedMinaNFTMapCalculation compiled");
      MinaNFT.redactedMapVerificationKey = verificationKey;
    }
    return MinaNFT.redactedMapVerificationKey;
  }
}
