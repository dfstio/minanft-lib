export { MapData, MinaNFTMapUpdate };
import { Poseidon } from "o1js";
import { BaseMinaNFTObject } from "../baseminanftobject";
import { PrivateMetadata } from "../privatemetadata";
import { MetadataMap } from "../contract/update";
import {
  MinaNFTStringUpdate,
  MinaNFTFieldUpdate,
  MinaNFTFileUpdate,
  MinaNFTTextUpdate,
} from "../update";
import { MinaNFT } from "../minanft";
import { TextData } from "./text";
import { File, FileData } from "./file";

/**
 * MinaNFTMapUpdate is the data for the update of the metadata to be written to the NFT state
 * with text value
 * Text can be of any length
 * @property key The key of the metadata
 * @property text The text
 * @property isPrivate True if the text is private, default is false
 */
interface MinaNFTMapUpdate {
  key: string;
  map: MapData;
  isPrivate?: boolean;
}

class MapData extends BaseMinaNFTObject {
  metadata: Map<string, PrivateMetadata>;

  constructor() {
    super("map");
    this.metadata = new Map<string, PrivateMetadata>();
  }

  /**
   * Calculates and sets a root of the MapData
   * Should be called before updating the NFT state!!!
   */
  public setRoot() {
    const map: MetadataMap = new MetadataMap();
    this.metadata.forEach((value: PrivateMetadata, key: string) => {
      const keyField = MinaNFT.stringToField(key);
      map.data.set(keyField, value.data);
      map.kind.set(keyField, value.kind);
    });
    this.root = Poseidon.hash([map.data.getRoot(), map.kind.getRoot()]);
  }
  /**
   * updates Metadata
   * @param key key to update
   * @param value value to update
   */
  public updateMetadata(key: string, value: PrivateMetadata): void {
    this.metadata.set(key, value);
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

    this.updateMetadata(
      data.key,
      new PrivateMetadata({
        data: fileData.root,
        kind: MinaNFT.stringToField("file"),
        isPrivate: data.isPrivate ?? false,
        linkedObject: fileData,
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
   * Converts a MapData to JSON
   * @returns map as JSON object
   */
  public toJSON(): object {
    return {
      type: this.type,
      properties: Object.fromEntries(this.metadata),
    };
  }
  public fromJSON(json: object): void {}
}