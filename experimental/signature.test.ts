// https://github.com/o1-labs/o1js/issues/1561

import { describe, expect, it } from "@jest/globals";
import {
  Cache,
  Field,
  PublicKey,
  PrivateKey,
  AccountUpdate,
  Signature,
  Bool,
  SmartContract,
  method,
  state,
  State,
  DeployArgs,
  Permissions,
  Mina,
  TokenContract,
  AccountUpdateForest,
  VerificationKey,
  Provable,
} from "o1js";

class MinaNFTContract extends SmartContract {
  @state(Field) value = State<Field>();

  async deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proof(),
    });
  }

  @method async approveEscrow2(
    //data: EscrowApproval,
    signature: Signature,
    owner: PublicKey
  ) {
    Provable.log("owner", owner);
    Provable.log("signature", signature);
    signature.verify(owner, [Field(30)]).assertEquals(Bool(true));
  }

  @method async approveEscrow(
    //data: EscrowApproval,
    signature: Signature,
    owner: PublicKey
  ) {
    Provable.log("owner", owner);
    Provable.log("signature", signature);
    signature.verify(owner, [Field(2)]).assertEquals(Bool(true));
  }
}

class MyTokenContract extends TokenContract {
  @state(Field) mystate = State<Field>();

  async deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proof(),
    });
  }

  async approveBase(forest: AccountUpdateForest) {
    throw Error(
      "transfers of tokens are not allowed, change the owner instead"
    );
  }

  @method async mint(address: PublicKey, verificationKey: VerificationKey) {
    this.internal.mint({ address, amount: 1_000_000_000 });
    const tokenId = this.deriveTokenId();
    const update = AccountUpdate.createSigned(address, tokenId);
    update.body.update.verificationKey = {
      isSome: Bool(true),
      value: verificationKey,
    };
    update.body.update.permissions = {
      isSome: Bool(true),
      value: {
        ...Permissions.default(),
        editState: Permissions.proof(),
      },
    };
  }

  @method async approveEscrow(
    address: PublicKey,
    //data: EscrowApproval,
    signature: Signature,
    owner: PublicKey
  ) {
    //this.isNFT(address);
    const tokenId = this.deriveTokenId();
    const nft = new MinaNFTContract(address, tokenId);
    await nft.approveEscrow(signature, owner);
    //this.emitEvent("approveEscrow", data);
  }
}

describe("Signature", () => {
  it(`should verify signature in the SmartContract`, async () => {
    const cache: Cache = Cache.FileSystem("./cache");
    const local = await Mina.LocalBlockchain({
      proofsEnabled: true,
    });
    Mina.setActiveInstance(local);
    const { privateKey: deployer, publicKey: sender } = local.testAccounts[0];
    console.log("Compiling ...");
    await MyTokenContract.compile({ cache });
    const vk = (await MinaNFTContract.compile({ cache })).verificationKey;

    console.log("Deploying MyTokenContract...");
    const zkAppPrivateKey = PrivateKey.random();
    const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    const zkApp = new MyTokenContract(zkAppPublicKey);
    const tokenId = zkApp.deriveTokenId();
    const memo =
      "Deploying MyTokenContract... jfeo jiewo jewio jiweo jwoi ijow ";
    console.log("memo size", memo.length);
    const tx1 = await Mina.transaction({ sender, memo }, async () => {
      AccountUpdate.fundNewAccount(sender);
      await zkApp.deploy({});
    });
    await tx1.sign([deployer, zkAppPrivateKey]).send();

    console.log("Deploying MinaNFTContract...");
    const tokenPrivateKey = PrivateKey.random();
    const tokenPublicKey = tokenPrivateKey.toPublicKey();
    const tx2 = await Mina.transaction({ sender }, async () => {
      AccountUpdate.fundNewAccount(sender);
      await zkApp.mint(tokenPublicKey, vk);
    });
    await tx2.prove();
    await tx2.sign([deployer, tokenPrivateKey]).send();
    const token = new MinaNFTContract(tokenPublicKey, tokenId);
    expect(token.value.get().toJSON()).toBe("0");

    console.log("Sending the transaction with signature...");
    const owner = PrivateKey.random();
    const signature = Signature.create(owner, [Field(2)]);
    const tx = await Mina.transaction({ sender }, async () => {
      await zkApp.approveEscrow(tokenPublicKey, signature, owner.toPublicKey());
    });
    await tx.prove();
    await tx.sign([deployer, zkAppPrivateKey]).send();
  });
});
