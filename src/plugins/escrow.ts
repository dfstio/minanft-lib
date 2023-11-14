export { Escrow, EscrowDeposit };
import {
  Field,
  method,
  DeployArgs,
  Permissions,
  SmartContract,
  UInt64,
  Signature,
  PublicKey,
  Poseidon,
  AccountUpdate,
  Struct,
} from "o1js";
import { MinaNFTContract } from "../contract/nft";
import { EscrowTransfer } from "../contract/escrow";

class EscrowDeposit extends Struct({
  data: EscrowTransfer,
  signature: Signature,
}) {
  constructor(args: any) {
    super(args);
  }
}

/**
 * class Escrow
 *
 */
class Escrow extends SmartContract {
  events = {
    deploy: Field,
    transfer: EscrowTransfer,
    deposit: EscrowTransfer,
    approveSale: EscrowTransfer,
  };

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proof(),
    });
    this.emitEvent("deploy", Field(0));
  }

  @method deposit(deposited: EscrowDeposit, buyer: PublicKey) {
    deposited.data.newOwner.assertEquals(Poseidon.hash(buyer.toFields()));
    deposited.data.tokenId.assertEquals(Field(0)); // should be MINA
    //const senderUpdate = AccountUpdate.create(buyer);
    //senderUpdate.requireSignature();
    //senderUpdate.send({ to: this.address, amount: deposited.data.price });
    this.emitEvent("deposit", deposited.data);
  }

  @method approveSale(deposited: EscrowDeposit, seller: PublicKey) {
    deposited.data.oldOwner.assertEquals(Poseidon.hash(seller.toFields()));
    deposited.data.tokenId.assertEquals(Field(0)); // should be MINA
    this.emitEvent("deposit", deposited.data);
  }

  @method transfer(
    nft: PublicKey,
    data: EscrowTransfer,
    signature1: Signature,
    signature2: Signature,
    signature3: Signature,
    escrow1: PublicKey,
    escrow2: PublicKey,
    escrow3: PublicKey,
    amount: UInt64,
    seller: PublicKey,
    buyer: PublicKey
  ) {
    data.price.assertEquals(amount);
    data.tokenId.assertEquals(Field(0)); // should be MINA
    data.oldOwner.assertEquals(Poseidon.hash(seller.toFields()));
    data.newOwner.assertEquals(Poseidon.hash(buyer.toFields()));
    const minanft = new MinaNFTContract(nft);
    minanft.transfer(
      data,
      signature1,
      signature2,
      signature3,
      escrow1,
      escrow2,
      escrow3
    );
    //this.send({ to: seller, amount });
    this.emitEvent("transfer", data);
  }
}
