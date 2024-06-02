import { VerificationKey, Field } from "o1js";
import config from "./config";

export * from "./minanft";
export * from "./minanftnames";
export * from "./update";
export * from "./minanftbadge";
export * from "./escrow";
export * from "./redactedminanft";
export * from "./redactedtree";
export * from "./baseminanft";
export * from "./privatemetadata";
export * from "./baseminanftobject";
export * from "./contract/nft";
export * from "./contract/transfer";
export * from "./contract/names";
export * from "./contract/escrow";
export * from "./contract/metadata";
export * from "./contract/update";
export * from "./plugins/badge";
export * from "./plugins/badgeproof";
export * from "./plugins/redactedmap";
export * from "./plugins/redactedtree";
export * from "./plugins/redactedtree20";
export * from "./plugins/verifier";
export * from "./plugins/escrow";
export * from "./storage/ipfs";
export * from "./storage/arweave";
export * from "./storage/file";
export * from "./storage/fast-tree";
export * from "./storage/map";
export * from "./storage/text";
export * from "./mina";
export * from "./fetch";
export * from "./networks";
export * from "./plugins/backend";
export * from "./api/api";
export * from "./lib/base64";
export * from "./lib/fields";
export * from "./rollupnft";
export * from "./rollupnft";
export * from "./contract-v2/nft";
export * from "./contract-v2/sign-test";
const NAMES_ORACLE = "B62qids6rU9iqjvBV4DHxW8z67mgHFws1rPmFoqpcyRq2arYxUw6sZu";
const MINANFT_NAME_SERVICE =
  "B62qrryunX2LzaZ1sGtqfJqzSdNdN7pVSZw8YtnxQNxrrF9Vt56bNFT";
const VERIFICATION_KEY_HASH =
  "10063414310819081074150032663721926544337121483850004965294429026545856295819";
const VERIFIER = "B62qqzwDxiH172SXE4SUVYsNV2FteL2UeYFsjRqF4Qf42KnE1q1VNFT";

const { MINANFT_NAME_SERVICE_V2, VERIFICATION_KEY_V2_JSON } = config;
const VERIFICATION_KEY_V2: VerificationKey = {
  hash: Field.fromJSON(VERIFICATION_KEY_V2_JSON.hash),
  data: VERIFICATION_KEY_V2_JSON.data,
} as VerificationKey;

export {
  NAMES_ORACLE,
  MINANFT_NAME_SERVICE,
  MINANFT_NAME_SERVICE_V2,
  VERIFICATION_KEY_HASH,
  VERIFIER,
  VERIFICATION_KEY_V2,
};
