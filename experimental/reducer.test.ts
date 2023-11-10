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
  Reducer,
  Poseidon,
  MerkleMap,
  Bool,
} from "o1js";
import { MINAURL, ARCHIVEURL } from "../src/config.json";
import { MinaNFT } from "../src/minanft";
import { DEPLOYER } from "../env.json";
const transactionFee = 150_000_000;

jest.setTimeout(1000 * 60 * 60); // 1 hour

let deployer: PrivateKey | undefined = undefined;
const useLocal: boolean = false;

class Update extends Struct({
  oldRoot: Field,
  newRoot: Field,
}) {}

class NFT extends SmartContract {
  @state(Field) root = State<Field>();
  @state(Field) pwdHash = State<Field>();
  @state(Field) actionState = State<Field>();
  @state(Bool) isDispatched = State<Bool>();

  reducer = Reducer({ actionType: Update });

  events = {
    deploy: Field,
    update: Update,
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

  @method dispatchState(data: Update, secret: Field) {
    this.pwdHash.assertEquals(this.pwdHash.get());
    this.pwdHash.assertEquals(Poseidon.hash([secret]));
    this.reducer.dispatch(data);
    this.emitEvent("update", data);
    this.isDispatched.assertEquals(this.isDispatched.get());
    this.isDispatched.assertEquals(Bool(false));
    this.isDispatched.set(Bool(true));
  }

  @method reduceState(root: Field) {
    const actionState = this.actionState.get();
    this.actionState.assertEquals(actionState);
    this.root.assertEquals(this.root.get());
    this.root.assertEquals(root);

    // compute the new counter and hash from pending actions
    const pendingActions = this.reducer.getActions({
      fromActionState: actionState,
    });

    let { state: newRoot, actionState: newActionState } = this.reducer.reduce(
      pendingActions,
      // state type
      Field,
      // function that says how to apply an action
      (state: Field, action: Update) => {
        return action.newRoot;
      },
      { state: root, actionState }
    );

    // update on-chain state
    this.root.set(newRoot);
    this.actionState.set(newActionState);
    this.isDispatched.set(Bool(false));
  }
}

beforeAll(async () => {
  if (useLocal) {
    const Local = Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);
    const { privateKey } = Local.testAccounts[0];
    deployer = privateKey;
  } else {
    const network = Mina.Network({
      mina: MINAURL,
      archive: ARCHIVEURL,
    });
    /*
    const Network = Mina.Network({
      mina: '', // Use https://proxy.berkeley.minaexplorer.com/graphql or https://api.minascan.io/node/berkeley/v1/graphql
      archive: '', // Use https://api.minascan.io/archive/berkeley/v1/graphql/ or https://archive.berkeley.minaexplorer.com/
    });
    Mina.setActiveInstance(Network);
    */
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
  await NFT.compile();
  //await Reader.compile();
  console.log("Compiled");
});

describe("Actions and Reducer", () => {
  it("should deploy and reduce action", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;

    const sender = deployer.toPublicKey();
    const zkAppPrivateKey = PrivateKey.random();
    const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    console.log(
      `deploying the NFT contract to an address ${zkAppPublicKey.toBase58()} using the deployer with public key ${sender.toBase58()}...`
    );
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppPublicKey });

    const zkApp = new NFT(zkAppPublicKey);
    const map = new MerkleMap();
    map.set(Field(1), Field(2));
    const root = map.getRoot();
    console.log("Root", root.toJSON());
    const secret = Field.random();
    const pwdHash = Poseidon.hash([secret]);
    const actionState = Reducer.initialActionState;
    //console.log("Version", version.toJSON());

    let transaction = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkApp.deploy({});
        zkApp.root.set(root);
        zkApp.pwdHash.set(pwdHash);
        zkApp.actionState.set(actionState);
        zkApp.isDispatched.set(Bool(false));
      }
    );

    await transaction.prove();
    transaction.sign([deployer, zkAppPrivateKey]);

    //console.log("Sending the deploy transaction...");
    let tx = await transaction.send();
    if (!useLocal) await MinaNFT.transactionInfo(tx);
    await fetchAccount({ publicKey: zkAppPublicKey });

    let pendingActions = await zkApp.reducer.fetchActions({
      fromActionState: actionState,
    });
    console.log("Pending actions", pendingActions.length);
    map.set(Field(3), Field(4));
    map.set(Field(5), Field(6));
    const root2 = map.getRoot();
    console.log("Root2", root2.toJSON());
    let data = new Update({ oldRoot: root, newRoot: root2 });
    console.log("Dispatch 1");
    transaction = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        zkApp.dispatchState(data, secret);
      }
    );

    await transaction.prove();
    transaction.sign([deployer]);

    //console.log("Sending the deploy transaction...");
    tx = await transaction.send();
    if (!useLocal) await MinaNFT.transactionInfo(tx);
    await fetchAccount({ publicKey: zkAppPublicKey });
    pendingActions = await zkApp.reducer.fetchActions({
      fromActionState: actionState,
    });
    console.log("Pending actions", pendingActions.length);
    console.log("Reduce 1");
    transaction = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        zkApp.reduceState(root);
      }
    );

    await transaction.prove();
    transaction.sign([deployer]);

    //console.log("Sending the deploy transaction...");
    tx = await transaction.send();
    if (!useLocal) await MinaNFT.transactionInfo(tx);

    await fetchAccount({ publicKey: zkAppPublicKey });
    pendingActions = await zkApp.reducer.fetchActions({
      fromActionState: actionState,
    });
    console.log("Pending actions", pendingActions.length);
    const newRoot = zkApp.root.get();
    expect(newRoot.toJSON()).toBe(root2.toJSON());

    await fetchAccount({ publicKey: zkAppPublicKey });
    map.set(Field(8), Field(4));
    map.set(Field(9), Field(1));
    const root3 = map.getRoot();
    console.log("Root3", root3.toJSON());
    data = new Update({ oldRoot: root2, newRoot: root3 });
    console.log("Dispatch 2");
    transaction = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        zkApp.dispatchState(data, secret);
      }
    );

    await transaction.prove();
    transaction.sign([deployer]);

    //console.log("Sending the deploy transaction...");
    tx = await transaction.send();
    if (!useLocal) await MinaNFT.transactionInfo(tx);
    await sleep(600 * 1000);
    await fetchAccount({ publicKey: zkAppPublicKey });
    pendingActions = await zkApp.reducer.fetchActions({
      fromActionState: actionState,
    });
    console.log("Pending actions", pendingActions.length);
    console.log("Reduce 2");
    transaction = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        zkApp.reduceState(root2);
      }
    );

    await transaction.prove();
    transaction.sign([deployer]);

    //console.log("Sending the deploy transaction...");
    tx = await transaction.send();
    if (!useLocal) await MinaNFT.transactionInfo(tx);
    await sleep(600 * 1000);

    await fetchAccount({ publicKey: zkAppPublicKey });
    const newRoot3 = zkApp.root.get();
    expect(newRoot3.toJSON()).toBe(root3.toJSON());
    pendingActions = await zkApp.reducer.fetchActions({
      fromActionState: actionState,
    });
    console.log("Pending actions", pendingActions.length);
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
