export { BaseMinaNFT, PrivateMetadata };
import { Field, Cache, VerificationKey, Encoding } from "o1js";
import { MinaNFT } from "./minanft";
import { MinaNFTContract } from "./contract/nft";
import { BaseMinaNFTObject } from "./baseminanftobject";
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

/**
 * Base class for MinaNFT
 */
class BaseMinaNFT {
  metadata: Map<string, PrivateMetadata>;
  static verificationKey: VerificationKey | undefined;
  static updaterVerificationKey: VerificationKey | undefined;
  static updateVerificationKey: string | undefined;
  static verifierVerificationKey: VerificationKey | undefined;
  static redactedMapVerificationKey: string | undefined;
  static badgeVerifierVerificationKey: VerificationKey | undefined;
  static badgeVerificationKey: string | undefined;
  static escrowVerificationKey: VerificationKey | undefined;

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
   * Compiles Escrow contract
   * @returns verification key
   */
  public static async compileEscrow(): Promise<VerificationKey> {
    if (MinaNFT.escrowVerificationKey === undefined) {
      console.time("Escrow compiled");
      const { verificationKey } = await Escrow.compile();
      console.timeEnd("Escrow compiled");
      MinaNFT.escrowVerificationKey = verificationKey as VerificationKey;
    }
    return MinaNFT.escrowVerificationKey;
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
