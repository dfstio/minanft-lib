export { EscrowApproval, EscrowTransfer };
import { Field, Struct, UInt64 } from "o1js";

class EscrowTransfer extends Struct({
  oldOwner: Field,
  newOwner: Field,
  name: Field,
  escrow: Field,
  version: UInt64,
  price: UInt64,
  tokenId: Field, // Field(0) for MINA payments
}) {
  constructor(args: any) {
    super(args);
  }

  toFields(): Field[] {
    return [
      this.oldOwner,
      this.newOwner,
      this.name,
      this.escrow,
      ...this.version.toFields(),
      ...this.price.toFields(),
      this.tokenId,
    ];
  }
}

class EscrowApproval extends Struct({
  name: Field,
  escrow: Field,
  owner: Field,
  version: UInt64,
}) {
  constructor(args: any) {
    super(args);
  }

  toFields() {
    return [this.name, this.escrow, this.owner, ...this.version.toFields()];
  }
}

/*
const Escrow = Experimental.ZkProgram({
  publicInput: EscrowData,

  methods: {
    create: {
      privateInputs: [
        Signature,
        Signature,
        Signature,
        PublicKey,
        PublicKey,
        PublicKey,
      ],

      method(
        escrow: EscrowData,
        signature1: Signature,
        signature2: Signature,
        signature3: Signature,
        escrow1: PublicKey,
        escrow2: PublicKey,
        escrow3: PublicKey
      ) {
        signature1.verify(escrow1, escrow.toFields());
        signature2.verify(escrow2, escrow.toFields());
        signature3.verify(escrow3, escrow.toFields());
        escrow.escrow.assertEquals(
          Poseidon.hash([
            Poseidon.hash(escrow1.toFields()),
            Poseidon.hash(escrow2.toFields()),
            Poseidon.hash(escrow3.toFields()),
          ])
        );
      },
    },
  },
});

class EscrowProof extends Experimental.ZkProgram.Proof(Escrow) {}
*/
