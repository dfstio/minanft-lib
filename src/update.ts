export {
  MinaNFTStringUpdate,
  MinaNFTFieldUpdate,
  MinaNFTImageUpdate,
  MinaNFTFileUpdate,
  MinaNFTTextUpdate,
  MinaNFTMint,
  MinaNFTTransfer,
  MinaNFTApproval,
  MinaNFTCommit,
};

import { MinaNFTNameService } from "./minanftnames";
import { EscrowTransfer, EscrowApproval } from "./contract/escrow";
import { Field, PrivateKey, PublicKey, Signature } from "o1js";

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

/**
 * MinaNFTMint is the data for the minting of the NFT
 * @property deployer The deployer of the contract
 * @property owner The owner of the NFT - Poseidon hash of owner's public key
 * @property pinataJWT Pinata JWT token for uploading to the IPFS
 * @property privateKey The private key of the owner, if not provided, will be generated
 * @property escrow The escrow of the NFT - Poseidon hash of three escrow's public keys
 * @property namesService The names service that will mint the NFT
 * @property nonce The nonce of the minting transaction
 */
interface MinaNFTMint {
  deployer: PrivateKey;
  owner: Field;
  pinataJWT: string;
  privateKey?: PrivateKey;
  escrow?: Field;
  namesService?: MinaNFTNameService;
  nonce?: number;
}

/**
 * MinaNFTTransfer is the data for the transfer of the NFT
 * @property deployer The deployer of the contract
 * @property data {@link EscrowTransfer} - data for the transfer
 * @property signature1 signature of the first escrow
 * @property signature2 signature of the second escrow
 * @property signature3 signature of the third escrow
 * @property escrow1 public key of the first escrow
 * @property escrow2 public key of the second escrow
 * @property escrow3 public key of the third escrow
 * @property namesService The names service that will transfer the NFT
 * @property nonce The nonce of the transfer transaction
 */
interface MinaNFTTransfer {
  deployer: PrivateKey;
  data: EscrowTransfer;
  signature1: Signature;
  signature2: Signature;
  signature3: Signature;
  escrow1: PublicKey;
  escrow2: PublicKey;
  escrow3: PublicKey;
  namesService?: MinaNFTNameService;
  nonce?: number;
}

/**
 * MinaNFTApproval is the data for the approval of the escrow change
 * @property deployer The deployer of the contract
 * @property data {@link EscrowApproval} - data for the approval
 * @property signature signature of the owner
 * @property ownerPublicKey owner's public key
 * @property namesService The names service that will send the escrow change
 * @property nonce The nonce of the approval transaction
 */
interface MinaNFTApproval {
  deployer: PrivateKey;
  data: EscrowApproval;
  signature: Signature;
  ownerPublicKey: PublicKey;
  namesService?: MinaNFTNameService;
  nonce?: number;
}

/**
 * MinaNFTCommit is the data for the commit of the NFT
 * @property deployer The deployer of the contract
 * @property ownerPrivateKey The private key of the owner
 * @property pinataJWT Pinata JWT token for uploading to the IPFS
 * @property namesService The names service that will commit the NFT
 * @property nonce The nonce of the commit transaction
 */
interface MinaNFTCommit {
  deployer: PrivateKey;
  ownerPrivateKey: PrivateKey;
  pinataJWT: string;
  namesService?: MinaNFTNameService;
  nonce?: number;
}
