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
  UInt32,
  UInt64,
} from "o1js";

export const zkAppPrivateKey = PrivateKey.fromBase58(
  "EKEEdg6psSYmSvDU45Hznc8MuHJH5EFSgYuc2uRoWSYgNUicF9un"
);
export const zkAppPublicKey = PublicKey.fromBase58(
  "B62qphWWs8HNBAepakFneJxHB8DSR7641mvDTeWftApZTrxtA9oDFST"
);

export class MyContract extends SmartContract {
  @state(Field) value = State<Field>();

  async deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proof(),
    });
  }

  @method async setValue(value: Field) {
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
