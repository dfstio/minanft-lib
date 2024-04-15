import {
  state,
  State,
  Field,
  PublicKey,
  PrivateKey,
  SmartContract,
  method,
  DeployArgs,
  Permissions,
  Transaction,
  Mina,
  UInt64,
  ZkProgram,
} from "o1js";

export const zkAppPrivateKey = PrivateKey.fromBase58(
  "EKFS4FrnqvpovVG9w1mk8Sxh4jYjUTmUvuMq2UVTexYPs8ar16gy"
);
export const zkAppPublicKey = PublicKey.fromBase58(
  "B62qnu3LBeZEth6UwykT8Y8CmTKyJXQ19hM713444wARfDb4B5dDFST"
);

export const MyZkProgram = ZkProgram({
  name: "MyZkProgram",
  publicInput: Field,

  methods: {
    check: {
      privateInputs: [],
      async method(value: Field) {
        value.assertLessThanOrEqual(Field(100));
      },
    },
  },
});

export class MyZkProgramProof extends ZkProgram.Proof(MyZkProgram) {}

export class MyContract extends SmartContract {
  @state(Field) value = State<Field>();

  async deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proof(),
    });
  }

  @method async setValue(value: Field, proof: MyZkProgramProof) {
    proof.verify();
    proof.publicInput.assertEquals(value);
    this.value.set(value);
  }
}

export function serializeTransaction(tx: Transaction) {
  const length = tx.transaction.accountUpdates.length;
  let i: number;
  let blindingValues: string[] = [];
  for (i = 0; i < length; i++) {
    const la = tx.transaction.accountUpdates[i].lazyAuthorization;
    if (
      la !== undefined &&
      (la as any).blindingValue !== undefined &&
      (la as any).kind === "lazy-proof"
    )
      blindingValues.push(((la as any).blindingValue as Field).toJSON());
    else blindingValues.push("");
  }

  const serializedTransaction: string = JSON.stringify(
    {
      tx: tx.toJSON(),
      blindingValues,
      length,
      fee: tx.transaction.feePayer.body.fee.toJSON(),
      sender: tx.transaction.feePayer.body.publicKey.toBase58(),
      nonce: tx.transaction.feePayer.body.nonce.toBigint().toString(),
    },
    null,
    2
  );
  return serializedTransaction;
}

export function transactionParams(serializedTransaction: string): {
  fee: UInt64;
  sender: PublicKey;
  nonce: number;
} {
  const { fee, sender, nonce } = JSON.parse(serializedTransaction);
  return {
    fee: UInt64.fromJSON(fee),
    sender: PublicKey.fromBase58(sender),
    nonce: Number(nonce),
  };
}

export function deserializeTransaction(
  serializedTransaction: string,
  txNew: Transaction
): Transaction {
  const { tx, blindingValues, length } = JSON.parse(serializedTransaction);
  const transaction = Mina.Transaction.fromJSON(
    JSON.parse(tx)
  ) as Mina.Transaction;
  if (length !== txNew.transaction.accountUpdates.length) {
    throw new Error("New Transaction length mismatch");
  }
  if (length !== transaction.transaction.accountUpdates.length) {
    throw new Error("Serialized Transaction length mismatch");
  }
  for (let i = 0; i < length; i++) {
    transaction.transaction.accountUpdates[i].lazyAuthorization =
      txNew.transaction.accountUpdates[i].lazyAuthorization;
    if (blindingValues[i] !== "")
      (
        transaction.transaction.accountUpdates[i].lazyAuthorization as any
      ).blindingValue = Field.fromJSON(blindingValues[i]);
  }
  return transaction;
}
