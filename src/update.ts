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
  MinaNFTPrepareCommit,
  MinaNFTCommitData,
  RollupNFTCommit,
  RollupNFTCommitData,
};

import { MinaNFTNameService } from "./minanftnames";
import { EscrowTransfer, EscrowApproval } from "./contract/escrow";
import { Field, PrivateKey, PublicKey, Signature } from "o1js";
import { FileDataType } from "./storage/file";

/**
 * MinaNFTStringUpdate is the data for the update of the metadata to be written to the NFT state
 * with string value
 * String can be maximum 30 characters long
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
  pinataJWT?: string;
  arweaveKey?: string;
  calculateRoot?: boolean;
  IPFSHash?: string;
  ArweaveHash?: string;
  fileType?: FileDataType;
  fileMetadata?: Field;
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
  pinataJWT?: string;
  arweaveKey?: string;
  isPrivate?: boolean;
  calculateRoot?: boolean;
  IPFSHash?: string;
  ArweaveHash?: string;
  fileType?: FileDataType;
  fileMetadata?: Field;
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
 * @property pinataJWT Pinata JWT token for uploading to the IPFS - used first if provided
 * @property arweaveKey Arweave key for uploading to the Arweave - used if pinataJWT is not provided
 * @property privateKey The private key of the owner, if not provided, will be generated
 * @property escrow The escrow of the NFT - Poseidon hash of three escrow's public keys
 * @property nameService The names service that will mint the NFT
 * @property nonce The nonce of the minting transaction
 */
interface MinaNFTMint {
  deployer: PrivateKey;
  owner?: Field;
  pinataJWT?: string;
  arweaveKey?: string;
  privateKey?: PrivateKey;
  escrow?: Field;
  nameService?: MinaNFTNameService;
  signature?: Signature;
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
 * @property nameService The names service that will transfer the NFT
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
  nameService?: MinaNFTNameService;
  nonce?: number;
}

/**
 * MinaNFTApproval is the data for the approval of the escrow change
 * @property deployer The deployer of the contract
 * @property data {@link EscrowApproval} - data for the approval
 * @property signature signature of the owner
 * @property ownerPublicKey owner's public key
 * @property nameService The names service that will send the escrow change
 * @property nonce The nonce of the approval transaction
 */
interface MinaNFTApproval {
  deployer: PrivateKey;
  data: EscrowApproval;
  signature: Signature;
  ownerPublicKey: PublicKey;
  nameService?: MinaNFTNameService;
  nonce?: number;
}

/**
 * MinaNFTCommit is the data for the commit of the NFT
 * @property deployer The deployer of the contract
 * @property ownerPrivateKey The private key of the owner
 * @property pinataJWT Pinata JWT token for uploading to the IPFS
 * @property nameService The names service that will commit the NFT
 * @property nonce The nonce of the commit transaction
 */
interface MinaNFTCommit {
  deployer: PrivateKey;
  ownerPrivateKey: PrivateKey;
  pinataJWT?: string;
  arweaveKey?: string;
  nameService?: MinaNFTNameService;
  nonce?: number;
}

/**
 * RollupNFTCommit is the data for the commit of the NFT
 * @property pinataJWT Pinata JWT token for uploading to the IPFS
 * @property nameService The names service that will commit the NFT
 * @property generateProofData True if the proof data should be generated
 */
interface RollupNFTCommit {
  pinataJWT?: string;
  arweaveKey?: string;
  generateProofData?: boolean;
}

/**
 * MinaNFTPrepareCommit is the data for the commit of the NFT
 * @property ownerPrivateKey The private key of the owner
 * @property nameServiceAddress The names service address that will commit the NFT
 * @property pinataJWT Pinata JWT token for uploading to the IPFS
 * @property arweaveKey Arweave key for uploading to the Arweave
 */
interface MinaNFTPrepareCommit {
  ownerPrivateKey?: PrivateKey;
  ownerPublicKey: PublicKey;
  nameServiceAddress: PublicKey;
  pinataJWT?: string;
  arweaveKey?: string;
}

/**
 * MinaNFTCommitData is the data for the commit of the NFT
 * @property signature The signature of the owner
 * @property address The address of the NFT
 * @property update The update of the NFT
 * @property transactions The transactions of the NFT to make an update
 */
interface MinaNFTCommitData {
  signature: string;
  address: string;
  update: string;
  transactions: string[];
}

/**
 * RollupNFTCommitData is the data for the commit of the Rollup NFT
 * @property update The update of the NFT
 * @property transactions The transactions of the NFT to make an update
 */
interface RollupNFTCommitData {
  update: string;
  transactions: string[];
}
