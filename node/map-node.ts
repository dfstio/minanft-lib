import { File } from "./file-node";
import { MapData } from "../src/storage/map";
import { PrivateMetadata } from "../src";
import { MinaNFT } from "../src/minanft";
import { MinaNFTImageUpdate, MinaNFTFileUpdate } from "../src/update";
import { FileData } from "../src/storage/file";

/**
 * updates PrivateMetadata
 * @param data {@link MinaNFTFileUpdate} update data
 */
export async function updateFile(
  map: MapData,
  data: MinaNFTFileUpdate
): Promise<void> {
  const file = new File(data.filename, data.fileType, data.fileMetadata);
  console.log("Pinning file to IPFS...");
  await file.pin({
    pinataJWT: data.pinataJWT,
    arweaveKey: data.arweaveKey,
    keyvalues: { project: "MinaNFT", type: "file", nftType: "map" },
  });
  console.log("Calculating file Merkle tree root...");
  console.time("File Merkle tree root calculated");
  await file.treeData(data.calculateRoot ?? true);
  console.timeEnd("File Merkle tree root calculated");
  console.time("Calculated SHA-3 512");
  await file.sha3_512();
  console.timeEnd("Calculated SHA-3 512");
  const fileData: FileData = await file.data();

  map.updateMetadata(
    data.key,
    new PrivateMetadata({
      data: fileData.root,
      kind: MinaNFT.stringToField("file"),
      isPrivate: data.isPrivate ?? false,
      linkedObject: fileData,
    })
  );
}
