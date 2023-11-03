import { describe, expect, it } from "@jest/globals";
import {
  Field,
  state,
  State,
  method,
  DeployArgs,
  Permissions,
  SmartContract,
  AccountUpdate,
  fetchAccount,
  PrivateKey,
  Mina,
  PublicKey,
  UInt64,
  Struct,
  Experimental,
  Signature,
  Poseidon,
} from "o1js";
import { MINAURL } from "../src/config.json";
import { DEPLOYER } from "../env.json";
import { MinaNFT } from "../src/minanft";
const transactionFee = 150_000_000;

jest.setTimeout(1000 * 60 * 60); // 1 hour

let deployer: PrivateKey | undefined = undefined;
const useLocal: boolean = true;

class KeyValueEvent extends Struct({
  name: Field,
  key: Field,
  value: Field,
  escrow: Field,
}) {
  toFields() {
    return [this.name, this.key, this.value, this.escrow];
  }
}

class OwnerKeyValue extends Struct({
  owner: Field,
  data: KeyValueEvent,
}) {}

const Owner = Experimental.ZkProgram({
  publicInput: OwnerKeyValue,

  methods: {
    create: {
      privateInputs: [Signature, PublicKey],

      method(state: OwnerKeyValue, signature: Signature, owner: PublicKey) {
        signature.verify(owner, state.data.toFields());
        state.owner.assertEquals(Poseidon.hash(owner.toFields()));
      },
    },
  },
});

class OwnerProof extends Experimental.ZkProgram.Proof(Owner) {}

class EscrowData extends Struct({
  oldOwner: Field,
  newOwner: Field,
  name: Field,
  escrow: Field,
}) {
  toFields() {
    return [this.oldOwner, this.newOwner, this.name, this.escrow];
  }
}

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

class KeyValue extends SmartContract {
  @state(Field) key = State<Field>();
  @state(Field) value = State<Field>();
  @state(Field) name = State<Field>();
  @state(Field) owner = State<Field>();
  @state(Field) escrow = State<Field>();

  events = {
    deploy: Field,
    update: KeyValueEvent,
    transfer: EscrowData,
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
    this.emitEvent("deploy", Field(0));
  }

  init() {
    super.init();
  }

  @method update(proof: OwnerProof) {
    this.key.assertEquals(this.key.get());
    this.value.assertEquals(this.value.get());

    this.owner.assertEquals(this.owner.get());
    this.owner.assertEquals(proof.publicInput.owner);

    this.name.assertEquals(this.name.get());
    this.name.assertEquals(proof.publicInput.data.name);

    proof.verify();

    this.key.set(proof.publicInput.data.key);
    this.value.set(proof.publicInput.data.value);
    this.escrow.set(proof.publicInput.data.escrow);

    this.emitEvent("update", proof.publicInput.data);
  }

  @method transfer(proof: EscrowProof) {
    this.owner.assertEquals(this.owner.get());
    this.owner.assertEquals(proof.publicInput.oldOwner);
    this.escrow.assertEquals(this.escrow.get());
    this.escrow.assertEquals(proof.publicInput.escrow);
    // TODO: this.escrow.assertNotEquals(Field(0));
    this.name.assertEquals(this.name.get());
    this.name.assertEquals(proof.publicInput.name);

    proof.verify();

    this.owner.set(proof.publicInput.newOwner);

    this.emitEvent("transfer", proof.publicInput);
  }
}

beforeAll(async () => {
  if (useLocal) {
    const Local = Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);
    const { privateKey } = Local.testAccounts[0];
    deployer = privateKey;
  } else {
    const network = Mina.Network(MINAURL);
    Mina.setActiveInstance(network);
    deployer = PrivateKey.fromBase58(DEPLOYER);
  }
  const balanceDeployer =
    Number((await accountBalance(deployer.toPublicKey())).toBigInt()) / 1e9;
  console.log(
    "Balance of the Deployer is ",
    balanceDeployer.toLocaleString("en")
  );
  expect(balanceDeployer).toBeGreaterThan(2);
  if (balanceDeployer <= 2) return;

  console.log("Compiling the contracts...");
  console.time("compiled");
  await Owner.compile();
  await Escrow.compile();
  await KeyValue.compile();
  console.timeEnd("compiled");
});

describe("Deploy and set initial values", () => {
  it("should deploy and set values verifying signature", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;

    const sender = deployer.toPublicKey();
    const zkAppPrivateKey = PrivateKey.random();
    const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    const ownerPrivateKey = PrivateKey.random();
    const ownerPublicKey = ownerPrivateKey.toPublicKey();
    const ownerHash = Poseidon.hash(ownerPublicKey.toFields());

    const escrowPrivateKey1 = PrivateKey.random();
    const escrowPublicKey1 = escrowPrivateKey1.toPublicKey();
    const escrowPrivateKey2 = PrivateKey.random();
    const escrowPublicKey2 = escrowPrivateKey2.toPublicKey();
    const escrowPrivateKey3 = PrivateKey.random();
    const escrowPublicKey3 = escrowPrivateKey3.toPublicKey();
    const escrow = Poseidon.hash([
      Poseidon.hash(escrowPublicKey1.toFields()),
      Poseidon.hash(escrowPublicKey2.toFields()),
      Poseidon.hash(escrowPublicKey3.toFields()),
    ]);

    const name: Field = MinaNFT.stringToField("@account-abstraction");

    console.log(
      `deploying the KeyValue contract to an address ${zkAppPublicKey.toBase58()} using the deployer with public key ${sender.toBase58()}...`
    );
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppPublicKey });

    const zkApp = new KeyValue(zkAppPublicKey);
    const key: Field = Field.random();
    const value: Field = Field.random();
    const transaction = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkApp.deploy({});
        zkApp.key.set(key);
        zkApp.value.set(value);
        zkApp.name.set(name);
        zkApp.owner.set(ownerHash);
      }
    );

    await transaction.prove();
    transaction.sign([deployer, zkAppPrivateKey]);

    console.log("Sending the deploy transaction...");
    const tx = await transaction.send();
    if (!useLocal) await MinaNFT.transactionInfo(tx, "deploy");

    await fetchAccount({ publicKey: zkAppPublicKey });
    const newKey = zkApp.key.get();
    const newValue = zkApp.value.get();
    expect(newKey.toJSON()).toBe(key.toJSON());
    expect(newValue.toJSON()).toBe(value.toJSON());
    expect(zkApp.name.get().toJSON()).toBe(name.toJSON());
    expect(zkApp.owner.get().toJSON()).toBe(ownerHash.toJSON());
    expect(zkApp.escrow.get().toJSON()).toBe(Field(0).toJSON());

    const key1: Field = Field.random();
    const value1: Field = Field.random();
    const kv1 = new KeyValueEvent({ key: key1, value: value1, name, escrow });
    const signature = Signature.create(ownerPrivateKey, kv1.toFields());
    const ownerKV = new OwnerKeyValue({
      owner: ownerHash,
      data: kv1,
    });
    const proof: OwnerProof = await Owner.create(
      ownerKV,
      signature,
      ownerPublicKey
    );
    const transaction1 = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        zkApp.update(proof);
      }
    );

    await transaction1.prove();
    transaction1.sign([deployer]);

    console.log("Sending the update transaction...");
    const tx1 = await transaction1.send();
    if (!useLocal) await MinaNFT.transactionInfo(tx1, "update");

    await fetchAccount({ publicKey: zkAppPublicKey });
    const newKey1 = zkApp.key.get();
    const newValue1 = zkApp.value.get();
    expect(newKey1.toJSON()).toBe(key1.toJSON());
    expect(newValue1.toJSON()).toBe(value1.toJSON());
    expect(zkApp.name.get().toJSON()).toBe(name.toJSON());
    expect(zkApp.owner.get().toJSON()).toBe(
      Poseidon.hash(ownerPublicKey.toFields()).toJSON()
    );
    expect(zkApp.escrow.get().toJSON()).toBe(escrow.toJSON());

    const newOwnerPrivateKey = PrivateKey.random();
    const newOwnerPublicKey = newOwnerPrivateKey.toPublicKey();
    const newOwnerHash = Poseidon.hash(newOwnerPublicKey.toFields());
    const escrowData = new EscrowData({
      oldOwner: ownerHash,
      newOwner: newOwnerHash,
      name,
      escrow,
    });
    const signature1 = Signature.create(
      escrowPrivateKey1,
      escrowData.toFields()
    );
    const signature2 = Signature.create(
      escrowPrivateKey2,
      escrowData.toFields()
    );
    const signature3 = Signature.create(
      escrowPrivateKey3,
      escrowData.toFields()
    );
    const proofEscrow: EscrowProof = await Escrow.create(
      escrowData,
      signature1,
      signature2,
      signature3,
      escrowPublicKey1,
      escrowPublicKey2,
      escrowPublicKey3
    );
    const transaction2 = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        zkApp.transfer(proofEscrow);
      }
    );

    await transaction2.prove();
    transaction2.sign([deployer]);

    console.log("Sending the transfer transaction...");
    const tx2 = await transaction2.send();
    if (!useLocal) await MinaNFT.transactionInfo(tx2, "transfer");

    await fetchAccount({ publicKey: zkAppPublicKey });
    const newOwner = zkApp.owner.get();
    expect(newOwner.toJSON()).toBe(newOwnerHash.toJSON());

    const key2: Field = Field.random();
    const value2: Field = Field.random();
    const kv2 = new KeyValueEvent({ key: key2, value: value2, name, escrow });
    const signature4 = Signature.create(newOwnerPrivateKey, kv2.toFields());
    const ownerKV2 = new OwnerKeyValue({
      owner: newOwnerHash,
      data: kv2,
    });
    const proof2: OwnerProof = await Owner.create(
      ownerKV2,
      signature4,
      newOwnerPublicKey
    );
    const transaction3 = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        zkApp.update(proof2);
      }
    );

    await transaction3.prove();
    transaction3.sign([deployer]);

    console.log("Sending the second update transaction...");
    const tx3 = await transaction3.send();
    if (!useLocal) await MinaNFT.transactionInfo(tx3, "update");

    await fetchAccount({ publicKey: zkAppPublicKey });
    const newKey2 = zkApp.key.get();
    const newValue2 = zkApp.value.get();
    expect(newKey2.toJSON()).toBe(key2.toJSON());
    expect(newValue2.toJSON()).toBe(value2.toJSON());
    expect(zkApp.name.get().toJSON()).toBe(name.toJSON());
    expect(zkApp.owner.get().toJSON()).toBe(newOwnerHash.toJSON());
    expect(zkApp.escrow.get().toJSON()).toBe(escrow.toJSON());
  });
});

async function accountBalance(address: PublicKey): Promise<UInt64> {
  let check = Mina.hasAccount(address);
  if (!check) {
    await fetchAccount({ publicKey: address });
    check = Mina.hasAccount(address);
    if (!check) return UInt64.from(0);
  }
  const balance = Mina.getBalance(address);
  return balance;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
