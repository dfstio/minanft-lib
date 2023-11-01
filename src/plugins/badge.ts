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

export class MinaNFTVerifierBadgeEvent extends Struct({
  address: PublicKey,
  owner: Field,
  name: Field,
  data: Metadata,
  key: Field,
}) {
  constructor(args: any) {
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

export class MinaNFTVerifierBadge extends SmartContract {
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
      setDelegate: Permissions.proof(),
      setPermissions: Permissions.proof(),
      setVerificationKey: Permissions.proof(),
      setZkappUri: Permissions.proof(),
      setTokenSymbol: Permissions.proof(),
      incrementNonce: Permissions.proof(),
      setVotingFor: Permissions.proof(),
      setTiming: Permissions.proof(),
    });
  }

  @method issueBadge(
    nft: PublicKey,
    badgeEvent: MinaNFTVerifierBadgeEvent,
    signature: Signature,
    proof: RedactedMinaNFTMapStateProof,
    badgeProof: MinaNFTBadgeProof
  ) {
    const minanft = new MinaNFTContract(nft);
    badgeEvent.owner.assertEquals(minanft.owner.getAndAssertEquals());
    badgeEvent.address.assertEquals(nft);
    badgeEvent.name.assertEquals(minanft.name.getAndAssertEquals());
    badgeProof.publicInput.data.kind.assertEquals(
      this.verifiedKind.getAndAssertEquals()
    );
    badgeProof.publicInput.key.assertEquals(
      this.verifiedKey.getAndAssertEquals()
    );

    Metadata.assertEquals(
      minanft.metadata.getAndAssertEquals(),
      proof.publicInput.originalRoot
    );
    Metadata.assertEquals(
      badgeProof.publicInput.root,
      proof.publicInput.redactedRoot
    );
    Metadata.assertEquals(badgeProof.publicInput.data, badgeEvent.data);

    signature.verify(this.oracle.getAndAssertEquals(), badgeEvent.toFields());
    proof.verify();
    badgeProof.verify();

    // Issue verification badge
    //TODO: change amount to version - balance
    this.token.mint({ address: nft, amount: UInt64.from(1) });

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
}
