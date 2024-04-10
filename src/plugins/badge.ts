export { MinaNFTVerifierBadgeEvent, MinaNFTVerifierBadge };

import {
  method,
  DeployArgs,
  Permissions,
  TokenContract,
  AccountUpdateForest,
  PublicKey,
  Field,
  Signature,
  State,
  state,
  Struct,
  Account,
  UInt64,
} from "o1js";

import { RedactedMinaNFTMapStateProof } from "./redactedmap";
import { MinaNFTContract } from "../contract/nft";
import { Metadata } from "../contract/metadata";
import { MinaNFTBadgeProof } from "./badgeproof";

class MinaNFTVerifierBadgeEvent extends Struct({
  address: PublicKey,
  owner: Field,
  name: Field,
  version: UInt64,
  data: Metadata,
  key: Field,
}) {
  constructor(args: {
    address: PublicKey;
    owner: Field;
    name: Field;
    version: UInt64;
    data: Metadata;
    key: Field;
  }) {
    super(args);
  }
}

class MinaNFTVerifierBadge extends TokenContract {
  @state(Field) name = State<Field>();
  @state(Field) owner = State<Field>();
  @state(Field) verifiedKey = State<Field>();
  @state(Field) verifiedKind = State<Field>();
  @state(PublicKey) oracle = State<PublicKey>();

  events = {
    deploy: Field,
    issue: MinaNFTVerifierBadgeEvent,
    revoke: PublicKey,
  };

  async deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proof(),
    });
  }

  async approveBase(forest: AccountUpdateForest) {
    // https://discord.com/channels/484437221055922177/1215258350577647616
    // this.checkZeroBalanceChange(forest);
    //forest.isEmpty().assertEquals(Bool(true));
    throw Error(
      "transfers of tokens are not allowed, change the owner instead"
    );
  }

  @method async issueBadge(
    nft: PublicKey,
    nftTokenId: Field,
    badgeEvent: MinaNFTVerifierBadgeEvent,
    signature: Signature,
    proof: RedactedMinaNFTMapStateProof,
    badgeProof: MinaNFTBadgeProof
  ) {
    /*
    Excluded pending resolution of the issue
    https://github.com/o1-labs/o1js/issues/1245
   
    const minanft = new MinaNFTContract(nft, nftTokenId);
    badgeEvent.owner.assertEquals(minanft.owner.getAndRequireEquals());
    badgeEvent.address.assertEquals(nft);
    badgeEvent.name.assertEquals(minanft.name.getAndRequireEquals());
    badgeEvent.version.assertEquals(minanft.version.getAndRequireEquals());
    Metadata.assertEquals(
      minanft.metadata.getAndRequireEquals(),
      proof.publicInput.originalRoot
    );
    */

    badgeProof.publicInput.data.kind.assertEquals(
      this.verifiedKind.getAndRequireEquals(),
      "Kind mismatch"
    );
    badgeProof.publicInput.key.assertEquals(
      this.verifiedKey.getAndRequireEquals(),
      "Key mismatch"
    );

    Metadata.assertEquals(
      badgeProof.publicInput.root,
      proof.publicInput.redactedRoot
    );
    Metadata.assertEquals(badgeProof.publicInput.data, badgeEvent.data);

    signature
      .verify(
        this.oracle.getAndRequireEquals(),
        MinaNFTVerifierBadgeEvent.toFields(badgeEvent)
      )
      .assertEquals(true);
    proof.verify();
    badgeProof.verify();

    // Issue verification badge
    const tokenId = this.deriveTokenId();
    const account = Account(nft, tokenId);
    const tokenBalance = account.balance.getAndRequireEquals();
    this.internal.mint({
      address: nft,
      amount: badgeEvent.version.sub(tokenBalance),
    });

    // Emit event
    this.emitEvent("issue", badgeEvent);
  }

  @method async revokeBadge(nft: PublicKey, signature: Signature) {
    const oracle = this.oracle.getAndRequireEquals();
    signature.verify(oracle, nft.toFields());

    const tokenId = this.deriveTokenId();
    const account = Account(nft, tokenId);
    const tokenBalance = account.balance.getAndRequireEquals();

    // Revoke verification badge
    this.internal.burn({ address: nft, amount: tokenBalance });

    // Emit event
    this.emitEvent("revoke", nft);
  }

  @method async verifyBadge(nft: PublicKey, nftTokenId: Field) {
    const tokenId = this.deriveTokenId();
    const account = Account(nft, tokenId);
    const tokenBalance = account.balance.getAndRequireEquals();

    const minanft = new MinaNFTContract(nft, nftTokenId);
    const version = minanft.version.getAndRequireEquals();

    version.assertEquals(tokenBalance);
  }
}
