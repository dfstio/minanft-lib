export {
  MinaNFTStringUpdate,
  MinaNFTFieldUpdate,
  MinaNFTImageUpdate,
  MinaNFTFileUpdate,
  MinaNFTTextUpdate,
};

import { Field } from "o1js";

/**
 * MinaNFTStringUpdate is the data for the update of the metadata to be written to the NFT state
 * with string value
 * String can be maximum 31 characters long
 * @property key The key of the metadata
 * @property value The value of the metadata
 * @property kind The kind of the metadata, default is "string"
 * @property isPrivate True if the metadata is private, default is false
 */
interface MinaNFTStringUpdate {
  key: string;
  value: string;
  kind?: string;
  isPrivate?: boolean;
}

/**
 * MinaNFTTextUpdate is the data for the update of the metadata to be written to the NFT state
 * with text value
 * Text can be of any length
 * @property key The key of the metadata
 * @property text The text
 * @property isPrivate True if the text is private, default is false
 */
interface MinaNFTTextUpdate {
  key: string;
  text: string;
  isPrivate?: boolean;
}

/**
 * MinaNFTImageUpdate is the data for the update of the image to be written to the NFT state
 * Image is always public and has the key "image"
 * @property filename The filename of the image
 * @property pinataJWT Pinata JWT token for uploading to the IPFS
 */
interface MinaNFTImageUpdate {
  filename: string;
  pinataJWT: string;
}

/**
 * MinaNFTFileUpdate is the data for the update of the file to be written to the NFT state
 * @property key The key of the metadata
 * @property filename The filename of the image
 * @property pinataJWT Pinata JWT token for uploading to the IPFS
 * @property isPrivate True if the file is private, default is false
 */
interface MinaNFTFileUpdate {
  key: string;
  filename: string;
  pinataJWT: string;
  isPrivate?: boolean;
}

/**
 * MinaNFTFieldUpdate is the data for the update of the metadata to be written to the NFT state
 * with Field value
 * @property key The key of the metadata
 * @property value The value of the metadata
 * @property kind The kind of the metadata, default is "string"
 * @property isPrivate True if the metadata is private, default is false
 */
interface MinaNFTFieldUpdate {
  key: string;
  value: Field;
  kind?: string;
  isPrivate?: boolean;
}
