export { MinaNFTVerifierBadgeEvent, MinaNFTVerifierBadge };

import {
  method,
  DeployArgs,
  Permissions,
  SmartContract,
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

  toFields() {
    return [
      ...this.address.toFields(),
      this.owner,
      this.name,
      this.data.data,
      this.data.kind,
      this.key,
    ];
  }
}

class MinaNFTVerifierBadge extends SmartContract {
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

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proof(),
    });
  }

  @method issueBadge(
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
    badgeEvent.owner.assertEquals(minanft.owner.getAndAssertEquals());
    badgeEvent.address.assertEquals(nft);
    badgeEvent.name.assertEquals(minanft.name.getAndAssertEquals());
    badgeEvent.version.assertEquals(minanft.version.getAndAssertEquals());
    Metadata.assertEquals(
      minanft.metadata.getAndAssertEquals(),
      proof.publicInput.originalRoot
    );
    */
    badgeProof.publicInput.data.kind.assertEquals(
      this.verifiedKind.getAndAssertEquals(),
      "Kind mismatch"
    );
    badgeProof.publicInput.key.assertEquals(
      this.verifiedKey.getAndAssertEquals(),
      "Key mismatch"
    );

    Metadata.assertEquals(
      badgeProof.publicInput.root,
      proof.publicInput.redactedRoot
    );
    Metadata.assertEquals(badgeProof.publicInput.data, badgeEvent.data);

    signature
      .verify(this.oracle.getAndAssertEquals(), badgeEvent.toFields())
      .assertEquals(true);
    proof.verify();
    badgeProof.verify();

    // Issue verification badge
    const account = Account(nft, this.token.id);
    const tokenBalance = account.balance.getAndAssertEquals();
    this.token.mint({
      address: nft,
      amount: badgeEvent.version.sub(tokenBalance),
    });

    // Emit event
    this.emitEvent("issue", badgeEvent);
  }

  @method revokeBadge(nft: PublicKey, signature: Signature) {
    const oracle = this.oracle.getAndAssertEquals();
    signature.verify(oracle, nft.toFields());

    const account = Account(nft, this.token.id);
    const tokenBalance = account.balance.getAndAssertEquals();

    // Revoke verification badge
    this.token.burn({ address: nft, amount: tokenBalance });

    // Emit event
    this.emitEvent("revoke", nft);
  }

  @method verifyBadge(nft: PublicKey, nftTokenId: Field) {
    const account = Account(nft, this.token.id);
    const tokenBalance = account.balance.getAndAssertEquals();

    const minanft = new MinaNFTContract(nft, nftTokenId);
    const version = minanft.version.getAndAssertEquals();

    version.assertEquals(tokenBalance);
  }
}
