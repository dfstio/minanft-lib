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
  Provable,
  Bool,
} from "o1js";
import { MINAURL, ARCHIVEURL } from "../src/config.json";
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

  /*
  @method update(key: Field, value: Field) {
    this.key.assertEquals(this.key.get());
    this.value.assertEquals(this.value.get());

    this.key.set(key);
    this.value.set(value);

    this.emitEvent("update", new KeyValueEvent({ key, value }));
  }
 */
}

/*
class Reader extends SmartContract {
  @state(Field) key = State<Field>();
  @state(Field) value = State<Field>();

  events = {
    deploy: Field,
    read: KeyValueEvent,
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

  @method read(key: Field, value: Field, address: PublicKey) {
    this.key.assertEquals(this.key.get());
    this.value.assertEquals(this.value.get());
    const keyvalue = new KeyValue(address);
    const otherKey = keyvalue.key.get();
    const otherValue = keyvalue.value.get();
    otherKey.assertEquals(key);
    otherValue.assertEquals(value);

    this.key.set(key);
    this.value.set(value);

    this.emitEvent("read", new KeyValueEvent({ key, value }));
  }
}
*/

beforeAll(async () => {
  if (useLocal) {
    const Local = Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);
    const { privateKey } = Local.testAccounts[0];
    deployer = privateKey;
  } else {
    const network = Mina.Network({ mina: MINAURL, archive: ARCHIVEURL });
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
    if (!useLocal) {
      if (tx.hash() !== undefined) {
        console.log(`
      Success! Deploy transaction sent.
    
      Your smart contract state will be updated
      as soon as the transaction is included in a block:
      https://berkeley.minaexplorer.com/transaction/${tx.hash()}
      `);
        try {
          await tx.wait();
        } catch (error) {
          console.log("Error waiting for transaction");
        }
      } else console.error("Send fail", tx);
      await sleep(30 * 1000);
    }

    await fetchAccount({ publicKey: zkAppPublicKey });
    /*
            type NetworkConfig = {
          minaEndpoint: string;
          minaFallbackEndpoints: string[];
          archiveEndpoint: string;
          archiveFallbackEndpoints: string[];
          lightnetAccountManagerEndpoint: string;
        };

        let networkConfig = {
          minaEndpoint: '',
          minaFallbackEndpoints: [] as string[],
          archiveEndpoint: '',
          archiveFallbackEndpoints: [] as string[],
          lightnetAccountManagerEndpoint: '',
        } satisfies NetworkConfig;
*/
    // graphqlEndpoint = networkConfig.archiveEndpoint
    let pendingActions = await zkApp.reducer.fetchActions({
      fromActionState: actionState,
    });
    console.log("Pending actions", pendingActions);
    map.set(Field(3), Field(4));
    map.set(Field(5), Field(6));
    const root2 = map.getRoot();
    console.log("Root2", root2.toJSON());
    let data = new Update({ oldRoot: root, newRoot: root2 });

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
    if (!useLocal) {
      if (tx.hash() !== undefined) {
        console.log(`
      Success! Dispatch 1 transaction sent.
    
      Your smart contract state will be updated
      as soon as the transaction is included in a block:
      https://berkeley.minaexplorer.com/transaction/${tx.hash()}
      `);
        try {
          await tx.wait();
        } catch (error) {
          console.log("Error waiting for transaction");
        }
      } else console.error("Send fail", tx);
      await sleep(30 * 1000);
    }

    await fetchAccount({ publicKey: zkAppPublicKey });
    pendingActions = await zkApp.reducer.fetchActions({
      fromActionState: actionState,
    });
    console.log("Pending actions", pendingActions);

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
    if (!useLocal) {
      if (tx.hash() !== undefined) {
        console.log(`
      Success! Reduce 1 transaction sent.
    
      Your smart contract state will be updated
      as soon as the transaction is included in a block:
      https://berkeley.minaexplorer.com/transaction/${tx.hash()}
      `);
        try {
          await tx.wait();
        } catch (error) {
          console.log("Error waiting for transaction");
        }
      } else console.error("Send fail", tx);
      await sleep(30 * 1000);
    }

    await fetchAccount({ publicKey: zkAppPublicKey });
    pendingActions = await zkApp.reducer.fetchActions({
      fromActionState: actionState,
    });
    console.log("Pending actions", pendingActions);
    const newRoot = zkApp.root.get();
    expect(newRoot.toJSON()).toBe(root2.toJSON());

    await fetchAccount({ publicKey: zkAppPublicKey });
    map.set(Field(8), Field(4));
    map.set(Field(9), Field(1));
    const root3 = map.getRoot();
    console.log("Root3", root3.toJSON());
    data = new Update({ oldRoot: root2, newRoot: root3 });

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
    if (!useLocal) {
      if (tx.hash() !== undefined) {
        console.log(`
      Success! Dispatch 2 transaction sent.
    
      Your smart contract state will be updated
      as soon as the transaction is included in a block:
      https://berkeley.minaexplorer.com/transaction/${tx.hash()}
      `);
        try {
          await tx.wait();
        } catch (error) {
          console.log("Error waiting for transaction");
        }
      } else console.error("Send fail", tx);
      await sleep(30 * 1000);
    }
    await sleep(60 * 1000);
    await fetchAccount({ publicKey: zkAppPublicKey });

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
    if (!useLocal) {
      if (tx.hash() !== undefined) {
        console.log(`
      Success! Reduce 2 transaction sent.
    
      Your smart contract state will be updated
      as soon as the transaction is included in a block:
      https://berkeley.minaexplorer.com/transaction/${tx.hash()}
      `);
        try {
          await tx.wait();
        } catch (error) {
          console.log("Error waiting for transaction", error);
        }
      } else console.error("Send fail", tx);
      await sleep(30 * 1000);
    }

    await fetchAccount({ publicKey: zkAppPublicKey });
    const newRoot3 = zkApp.root.get();
    expect(newRoot3.toJSON()).toBe(root3.toJSON());

    /*
    await fetchAccount({ publicKey: zkAppPublicKey });
    const newRoot = zkApp.root.get();
    expect(newRoot.toJSON()).toBe(root.toJSON());
    const newVersion = zkApp.version.get();
    expect(newVersion.toJSON()).toBe(version.toJSON());
    
    const zkReaderPrivateKey = PrivateKey.random();
    const zkReaderPublicKey = zkReaderPrivateKey.toPublicKey();
    console.log(
      `deploying the Reader contract to an address ${zkReaderPublicKey.toBase58()} using the deployer with public key ${sender.toBase58()}...`
    );
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkReaderPublicKey });

    const zkReader = new Reader(zkReaderPublicKey);
    const keyReader: Field = Field.random();
    const valueReader: Field = Field.random();
    const transactionReader = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkReader.deploy({});
        zkReader.key.set(keyReader);
        zkReader.value.set(valueReader);
      }
    );

    await transactionReader.prove();
    transactionReader.sign([deployer, zkReaderPrivateKey]);

    //console.log("Sending the deploy transaction...");
    const txReader = await transactionReader.send();
    if (!useLocal) {
      if (txReader.hash() !== undefined) {
        console.log(`
      Success! Deploy transaction sent.
    
      Your smart contract state will be updated
      as soon as the transaction is included in a block:
      https://berkeley.minaexplorer.com/transaction/${txReader.hash()}
      `);
        try {
          await txReader.wait();
        } catch (error) {
          console.log("Error waiting for transaction");
        }
      } else console.error("Send fail", txReader);
      await sleep(30 * 1000);
    }

    await fetchAccount({ publicKey: zkReaderPublicKey });
    const newKeyReader = zkReader.key.get();
    const newValueReader = zkReader.value.get();
    expect(newKeyReader.toJSON()).toBe(keyReader.toJSON());
    expect(newValueReader.toJSON()).toBe(valueReader.toJSON());
  */
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
