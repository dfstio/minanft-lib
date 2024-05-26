import { File } from "./file-node";
import { MinaNFT } from "../src/minanft";
import { MinaNFTImageUpdate, MinaNFTFileUpdate } from "../src/update";
import { FileData } from "../src/storage/file";

/**
 * updates PrivateMetadata
 * @param data {@link MinaNFTImageUpdate} update data
 */
export async function updateImage(
  nft: MinaNFT,
  data: MinaNFTImageUpdate
): Promise<void> {
  const file = new File(data.filename, data.fileType, data.fileMetadata);
  if (data.IPFSHash === undefined && data.ArweaveHash === undefined) {
    console.log("Pinning image...");
    await file.pin({
      pinataJWT: data.pinataJWT,
      arweaveKey: data.arweaveKey,
      keyvalues: { project: "MinaNFT", type: "image", nft: nft.name },
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
  nft.updateFileData({
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
export async function updateFile(
  nft: MinaNFT,
  data: MinaNFTFileUpdate
): Promise<void> {
  const file = new File(data.filename, data.fileType, data.fileMetadata);

  if (data.IPFSHash === undefined && data.ArweaveHash === undefined) {
    if (data.isPrivate !== true) {
      console.log("Pinning file...");
      await file.pin({
        pinataJWT: data.pinataJWT,
        arweaveKey: data.arweaveKey,
        keyvalues: { project: "MinaNFT", type: "file", nft: nft.name },
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
  nft.updateFileData({
    key: data.key,
    type: "file",
    data: fileData,
    isPrivate: data.isPrivate ?? false,
  });
}
