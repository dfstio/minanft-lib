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
export { RedactedTree } from "./redactedtree";
export { BaseMinaNFT } from "./baseminanft";
export { PrivateMetadata } from "./privatemetadata";
export { BaseMinaNFTObject, MinaNFTObjectType } from "./baseminanftobject";
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
export {
  File,
  FileData,
  FileDataType,
  FILE_TREE_HEIGHT,
  FILE_TREE_ELEMENTS,
} from "./storage/file";
export { calculateMerkleTreeRootFast } from "./storage/fast-tree";
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
  MinaNetwork,
} from "./mina";
export {
  fetchMinaAccount,
  fetchMinaActions,
  checkMinaZkappTransaction,
} from "./fetch";
export { MinaNetworkURL, Berkeley, Lightnet, TestWorld2 } from "./networks";
export { BackendPlugin } from "./plugins/backend";
//import { NAMES_ORACLE, MINANFT_NAME_SERVICE } from "./config";
const NAMES_ORACLE = "B62qids6rU9iqjvBV4DHxW8z67mgHFws1rPmFoqpcyRq2arYxUw6sZu";
const MINANFT_NAME_SERVICE =
  "B62qrryunX2LzaZ1sGtqfJqzSdNdN7pVSZw8YtnxQNxrrF9Vt56bNFT";
const VERIFICATION_KEY_HASH =
  "25100340742188881599554828471689155379673356363693753971207763169025647660600";
const VERIFIER = "B62qqzwDxiH172SXE4SUVYsNV2FteL2UeYFsjRqF4Qf42KnE1q1VNFT";

export { NAMES_ORACLE, MINANFT_NAME_SERVICE, VERIFICATION_KEY_HASH, VERIFIER };
export { api } from "./api/api";
