export { EscrowApproval, EscrowTransfer };
import { Field, Struct, UInt64 } from "o1js";
/**
 * EscrowTransfer is the data for transfer of the NFT from one owner to another
 * @property oldOwner The old owner of the NFT
 * @property newOwner The new owner of the NFT
 * @property name The name of the NFT
 * @property escrow The escrow of the NFT - Poseidon hash of the escrow public key
 * @property version The new version of the NFT, increases by one with the changing of the metadata or owner
 * @property price The price of the NFT
 * @property tokenId The tokenId of the NFT, Field(0) for MINA payments
 */
class EscrowTransfer extends Struct({
  oldOwner: Field,
  newOwner: Field,
  name: Field,
  escrow: Field,
  version: UInt64,
  price: UInt64,
  tokenId: Field, // Field(0) for MINA payments
}) {
  constructor(value: {
    oldOwner: Field;
    newOwner: Field;
    name: Field;
    escrow: Field;
    version: UInt64;
    price: UInt64;
    tokenId: Field;
  }) {
    super(value);
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

/**
 * EscrowApproval is the data for approval of the escrow change
 * @property name The name of the NFT
 * @property escrow The escrow of the NFT - Poseidon hash of the escrow public key
 * @property owner The owner of the NFT - Poseidon hash of the owner public key
 * @property version The new version of the NFT, increases by one with the changing of the metadata or owner
 */
class EscrowApproval extends Struct({
  name: Field,
  escrow: Field,
  owner: Field,
  version: UInt64,
}) {
  constructor(value: {
    name: Field;
    escrow: Field;
    owner: Field;
    version: UInt64;
  }) {
    super(value);
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
