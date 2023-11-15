export { MinaNFTNameServiceContract, NFTMintData, MintData };
import {
  method,
  SmartContract,
  AccountUpdate,
  PublicKey,
  state,
  State,
  Field,
  Bool,
  Permissions,
  DeployArgs,
  VerificationKey,
  Account,
  UInt64,
  Signature,
  Struct,
} from "o1js";
import { MinaNFTContract } from "./nft";
import { Update } from "./metadata";
import { MinaNFTMetadataUpdateProof } from "./update";
import { EscrowTransfer, EscrowApproval } from "./escrow";

class NFTMintData extends Struct({
  address: PublicKey,
  name: Field,
  initialState: [Field, Field, Field, Field, Field, Field, Field, Field],
  verifier: PublicKey,
}) {
  constructor(value: {
    address: PublicKey;
    name: Field;
    initialState: [Field, Field, Field, Field, Field, Field, Field, Field];
    verifier: PublicKey;
  }) {
    super(value);
  }
}

class MintData extends Struct({
  nft: NFTMintData,
  verificationKey: VerificationKey,
  signature: Signature,
}) {
  constructor(value: {
    nft: NFTMintData;
    verificationKey: VerificationKey;
    signature: Signature;
  }) {
    super(value);
  }
}

class MinaNFTNameServiceContract extends SmartContract {
  @state(Field) namesRoot0 = State<Field>();
  @state(Field) namesRoot1 = State<Field>();
  @state(PublicKey) oracle = State<PublicKey>();

  init() {
    super.init();
  }
  events = {
    mint: NFTMintData,
    upgrade: PublicKey,
    update: Update,
    transfer: EscrowTransfer,
    approveEscrow: EscrowApproval,
  };

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proof(),
    });
  }

  @method setNames(namesRoot0: Field, namesRoot1: Field, signature: Signature) {
    const oracle = this.oracle.getAndAssertEquals();
    signature
      .verify(oracle, [namesRoot0, namesRoot1, ...this.address.toFields()])
      .assertEquals(true);
    this.namesRoot0.set(namesRoot0);
    this.namesRoot1.set(namesRoot1);
  }

  @method setOracle(newOracle: PublicKey, signature: Signature) {
    const oracle = this.oracle.getAndAssertEquals();
    signature
      .verify(oracle, [...newOracle.toFields(), ...this.address.toFields()])
      .assertEquals(true);
    this.oracle.set(newOracle);
  }

  isNFT(address: PublicKey) {
    const account = Account(address, this.token.id);
    const tokenBalance = account.balance.getAndAssertEquals();
    tokenBalance.assertEquals(UInt64.from(1_000_000_000));
  }

  @method upgrade(
    address: PublicKey,
    vk: VerificationKey,
    signature: Signature
  ) {
    this.isNFT(address);
    const oracle = this.oracle.getAndAssertEquals();
    signature
      .verify(oracle, [...address.toFields(), vk.hash])
      .assertEquals(true);
    const update = AccountUpdate.createSigned(address, this.token.id);
    update.body.update.verificationKey = { isSome: Bool(true), value: vk };
    this.emitEvent("upgrade", address);
  }

  @method mint(data: MintData) {
    const oracle = this.oracle.getAndAssertEquals();
    data.signature
      .verify(oracle, [
        ...data.nft.address.toFields(),
        data.nft.name,
        data.verificationKey.hash,
        ...data.nft.verifier.toFields(),
      ])
      .assertEquals(true);
    data.nft.verifier.assertEquals(this.address);
    data.nft.name.assertEquals(data.nft.initialState[0]);
    this.token.mint({ address: data.nft.address, amount: 1_000_000_000 });
    const update = AccountUpdate.createSigned(data.nft.address, this.token.id);
    update.body.update.verificationKey = {
      isSome: Bool(true),
      value: data.verificationKey,
    };
    update.body.update.permissions = {
      isSome: Bool(true),
      value: {
        ...Permissions.default(),
        editState: Permissions.proof(),
      },
    };
    data.nft.initialState[0].assertEquals(data.nft.name);
    update.body.update.appState = [
      { isSome: Bool(true), value: data.nft.initialState[0] },
      { isSome: Bool(true), value: data.nft.initialState[1] },
      { isSome: Bool(true), value: data.nft.initialState[2] },
      { isSome: Bool(true), value: data.nft.initialState[3] },
      { isSome: Bool(true), value: data.nft.initialState[4] },
      { isSome: Bool(true), value: data.nft.initialState[5] },
      { isSome: Bool(true), value: data.nft.initialState[6] },
      { isSome: Bool(true), value: data.nft.initialState[7] },
    ];

    this.emitEvent("mint", data.nft);
  }

  /**
   * Update metadata of the NFT
   * @param address address of the NFT
   * @param update {@link Update} - data for the update
   * @param signature signature of the owner
   * @param owner owner's public key
   * @param proof {@link MinaNFTMetadataUpdateProof} - proof of the update of the metadata to be correctly inserted into the Merkle Map
   */
  @method update(
    address: PublicKey,
    update: Update,
    signature: Signature,
    owner: PublicKey,
    proof: MinaNFTMetadataUpdateProof
  ) {
    this.isNFT(address);
    this.address.assertEquals(update.verifier);
    const nft = new MinaNFTContract(address, this.token.id);
    nft.update(update, signature, owner, proof);
    this.emitEvent("update", update);
  }

  /**
   * Transfer the NFT to new owner
   * @param address address of the NFT
   * @param data {@link EscrowTransfer} - data for the transfer
   * @param signature1 signature of the first escrow
   * @param signature2 signature of the second escrow
   * @param signature3 signature of the third escrow
   * @param escrow1 public key of the first escrow
   * @param escrow2 public key of the second escrow
   * @param escrow3 public key of the third escrow
   */
  @method transfer(
    address: PublicKey,
    data: EscrowTransfer,
    signature1: Signature,
    signature2: Signature,
    signature3: Signature,
    escrow1: PublicKey,
    escrow2: PublicKey,
    escrow3: PublicKey
  ) {
    this.isNFT(address);
    const nft = new MinaNFTContract(address, this.token.id);
    nft.transfer(
      data,
      signature1,
      signature2,
      signature3,
      escrow1,
      escrow2,
      escrow3
    );
    this.emitEvent("transfer", data);
  }
  /**
   * Approve setting of the new escrow
   * @param address address of the NFT
   * @param data {@link EscrowApproval} - data for the approval
   * @param signature signature of the owner
   * @param owner owner's public key
   */
  @method approveEscrow(
    address: PublicKey,
    data: EscrowApproval,
    signature: Signature,
    owner: PublicKey
  ) {
    this.isNFT(address);
    const nft = new MinaNFTContract(address, this.token.id);
    nft.approveEscrow(data, signature, owner);
    this.emitEvent("approveEscrow", data);
  }
}
