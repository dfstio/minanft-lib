import {
  Field,
  ZkProgram,
  Struct,
  Signature,
  PublicKey,
  Poseidon,
  Bool,
} from "o1js";

import { EscrowApproval } from "./escrow";

export class EscrowTransferApproval extends Struct({
  approval: EscrowApproval,
  owner: Field,
}) {}

export const EscrowTransferVerification = ZkProgram({
  name: "EscrowTransferVerification",
  publicInput: EscrowTransferApproval,

  methods: {
    check: {
      privateInputs: [Signature, PublicKey],

      async method(
        data: EscrowTransferApproval,
        signature: Signature,
        publicKey: PublicKey
      ) {
        signature
          .verify(publicKey, EscrowApproval.toFields(data.approval))
          .assertEquals(Bool(true));
        data.owner.assertEquals(Poseidon.hash(publicKey.toFields()));
      },
    },
  },
});

export class EscrowTransferProof extends ZkProgram.Proof(
  EscrowTransferVerification
) {}
