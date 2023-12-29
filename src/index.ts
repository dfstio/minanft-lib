export { MinaNFT } from "./minanft";
export { MinaNFTNameService } from "./minanftnames";
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
} from "./update";
export { MinaNFTBadge, MinaNFTBadgeConstructor } from "./minanftbadge";
export { MinaNFTEscrow, EscrowTransferData } from "./escrow";
export { RedactedMinaNFT } from "./redactedminanft";
export { BaseMinaNFT } from "./baseminanft";
export { PrivateMetadata } from "./privatemetadata";
export { BaseMinaNFTObject } from "./baseminanftobject";
export { MinaNFTContract } from "./contract/nft";
export {
  MinaNFTNameServiceContract,
  NFTMintData,
  MintData,
} from "./contract/names";
export { EscrowTransfer, EscrowApproval } from "./contract/escrow";
export {
  Update,
  Metadata,
  MetadataWitness,
  Storage,
} from "./contract/metadata";
export {
  MetadataUpdate,
  MetadataTransition,
  MetadataMap,
  MinaNFTMetadataUpdate,
  MinaNFTMetadataUpdateProof,
} from "./contract/update";
export {
  MinaNFTVerifierBadgeEvent,
  MinaNFTVerifierBadge,
} from "./plugins/badge";
export {
  BadgeData,
  BadgeDataWitness,
  MinaNFTBadgeCalculation,
  MinaNFTBadgeProof,
} from "./plugins/badgeproof";
export {
  RedactedMinaNFTMapCalculation,
  RedactedMinaNFTMapState,
  RedactedMinaNFTMapStateProof,
  MapElement,
} from "./plugins/redactedmap";
export {
  MinaNFTTreeVerifierFunction,
  TreeElement,
  BaseRedactedMinaNFTTreeState,
} from "./plugins/redactedtree";
export {
  MerkleTreeWitness20,
  RedactedMinaNFTTreeState20,
  RedactedMinaNFTTreeCalculation20,
  RedactedMinaNFTTreeStateProof20,
  MinaNFTTreeVerifier20,
} from "./plugins/redactedtree20";
export { MinaNFTVerifier } from "./plugins/verifier";
export { Escrow, EscrowDeposit } from "./plugins/escrow";
export { IPFS } from "./storage/ipfs";
export { ARWEAVE } from "./storage/arweave";
export { File, FileData } from "./storage/file";
export {
  MapData,
  MinaNFTMapUpdate,
  MinaNFTTextDataUpdate,
  MinaNFTFileDataUpdate,
} from "./storage/map";
export { TextData } from "./storage/text";
export {
  blockchain,
  initBlockchain,
  Memory,
  makeString,
  sleep,
  accountBalance,
  accountBalanceMina,
  formatTime,
} from "./mina";
export { BackendPlugin } from "./plugins/backend";
//import { NAMES_ORACLE, MINANFT_NAME_SERVICE } from "./config";
const NAMES_ORACLE = "B62qids6rU9iqjvBV4DHxW8z67mgHFws1rPmFoqpcyRq2arYxUw6sZu";
const MINANFT_NAME_SERVICE =
  "B62qpiD9ZWPi1JCx7hd4XcRujM1qc5jCADhhJVzTm3zZBWBpyRr3NFT";
const VERIFICATION_KEY_HASH =
  "613784522098216559795127957261801623468949172707291417873842686663375900205";
const VERIFIER = "B62qnsUFJnVGwaCx7Vuxu89yeLNtEAumTrMfYphoyhV9UkHPXdWzVYq";

export { NAMES_ORACLE, MINANFT_NAME_SERVICE, VERIFICATION_KEY_HASH, VERIFIER };
export { api } from "./api/api";
