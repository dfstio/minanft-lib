export { MinaNFTNameServiceContract, NFTMintData, MintData };
import {
  method,
  TokenContract,
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
  AccountUpdateForest,
} from "o1js";
import { MinaNFTContract } from "./nft";
import { Update } from "./metadata";
import { MinaNFTMetadataUpdateProof } from "./update";
import { EscrowTransfer, EscrowApproval } from "./escrow";
import { EscrowTransferProof } from "./transfer";

/**
 * NFTMintData is the data for the minting of the NFT
 * @property address The address of the NFT
 * @property name The name of the NFT encoded in Field
 * @property initialState The initial state of the NFT (8 Fields)
 * @property verifier The verifier of the NFT - the Name Service contract that sends this update
 */
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

/**
 * MintData is the data for the minting of the NFT
 * @property nft The {@link NFTMintData} of the NFT
 * @property verificationKey The verification key of the MinaNFTContract
 * @property signature The signature of the name service allowing the use of name
 */
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

/**
 * MinaNFTNameServiceContract is a smart contract that implements the Mina NFT Name Service standard.
 * @property oracle The oracle of the contract - the public key used to sign name allowances
 */
class MinaNFTNameServiceContract extends TokenContract {
  @state(PublicKey) oracle = State<PublicKey>();

  init() {
    super.init();
  }
  events = {
    mint: NFTMintData,
    upgrade: PublicKey,
    update: Update,
    escrowTransfer: EscrowTransfer,
    approveEscrow: EscrowApproval,
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

  @method async setOracle(newOracle: PublicKey, signature: Signature) {
    const oracle = this.oracle.getAndRequireEquals();
    signature
      .verify(oracle, [...newOracle.toFields(), ...this.address.toFields()])
      .assertEquals(true);
    this.oracle.set(newOracle);
  }

  isNFT(address: PublicKey) {
    AccountUpdate.create(address, this.deriveTokenId())
      .account.balance.getAndRequireEquals()
      .assertEquals(UInt64.from(1_000_000_000));
  }

  /**
   * Upgrade the NFT to the new version
   * @param address the address of the NFT
   * @param vk the verification key of the new MinaNFTContract
   * @param signature the signature of the name service allowing the upgrading of the NFT
   */
  @method async upgrade(
    address: PublicKey,
    vk: VerificationKey,
    signature: Signature
  ) {
    this.isNFT(address);
    const oracle = this.oracle.getAndRequireEquals();
    signature
      .verify(oracle, [...address.toFields(), vk.hash])
      .assertEquals(true);
    const tokenId = this.deriveTokenId();
    const update = AccountUpdate.createSigned(address, tokenId);
    update.body.update.verificationKey = { isSome: Bool(true), value: vk };
    this.emitEvent("upgrade", address);
  }

  /**
   * Mints the NFT
   * @param data the {@link MintData} of the NFT
   */
  @method async mint(data: MintData) {
    const oracle = this.oracle.getAndRequireEquals();
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
    this.internal.mint({ address: data.nft.address, amount: 1_000_000_000 });
    const tokenId = this.deriveTokenId();
    const update = AccountUpdate.createSigned(data.nft.address, tokenId);
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
   * Updates metadata of the NFT
   * @param address address of the NFT
   * @param update {@link Update} - data for the update
   * @param signature signature of the owner
   * @param owner owner's public key
   * @param proof {@link MinaNFTMetadataUpdateProof} - proof of the update of the metadata to be correctly inserted into the Merkle Map
   */
  @method async update(
    address: PublicKey,
    update: Update,
    signature: Signature,
    owner: PublicKey,
    proof: MinaNFTMetadataUpdateProof
  ) {
    this.isNFT(address);
    this.address.assertEquals(update.verifier);
    const tokenId = this.deriveTokenId();
    const nft = new MinaNFTContract(address, tokenId);
    await nft.update(update, signature, owner, proof);
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
  @method async escrowTransfer(
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
    const tokenId = this.deriveTokenId();
    const nft = new MinaNFTContract(address, tokenId);
    await nft.escrowTransfer(
      data,
      signature1,
      signature2,
      signature3,
      escrow1,
      escrow2,
      escrow3
    );
    this.emitEvent("escrowTransfer", data);
  }
  /**
   * Approve setting of the new escrow
   * @param address address of the NFT
   * @param proof {@link EscrowTransferProof} - escrow proof
   */
  @method async approveEscrow(address: PublicKey, proof: EscrowTransferProof) {
    this.isNFT(address);
    const tokenId = this.deriveTokenId();
    const nft = new MinaNFTContract(address, tokenId);
    await nft.approveEscrow(proof);
    this.emitEvent("approveEscrow", proof.publicInput.approval);
  }
}
