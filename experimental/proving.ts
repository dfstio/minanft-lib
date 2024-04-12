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
