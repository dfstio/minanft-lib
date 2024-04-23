import { describe, expect, it } from "@jest/globals";
import {
  method,
  SmartContract,
  AccountUpdate,
  fetchAccount,
  PrivateKey,
  Mina,
  PublicKey,
  Account,
  UInt64,
  state,
  State,
  DeployArgs,
  Permissions,
} from "o1js";

// Private key of the deployer:
import { DEPLOYER } from "../env.json";
import { accountBalance } from "../utils/testhelpers";

// True - local blockchain, false - Berkeley
const useLocalBlockchain: boolean = true;

const MINAURL = "https://proxy.berkeley.minaexplorer.com/graphql";
const ARCHIVEURL = "https://archive.berkeley.minaexplorer.com";
const tokenSymbol = "TEST";
const transactionFee = 150_000_000;
jest.setTimeout(1000 * 60 * 60 * 10); // 10 hours
let deployer: PrivateKey | undefined = undefined;
let user: PrivateKey | undefined = undefined;

/*
class Counter extends SmartContract {
  @state(UInt64) counter = State<UInt64>();

  @method increaseCounter() {
    const counter = this.counter.getAndRequireEquals();
    const newCounter = counter.add(UInt64.from(1));
    this.counter.set(newCounter);
  }
}

class Token extends SmartContract {
  @method mint(address: PublicKey, balance: UInt64) {
    const account = Account(address, this.token.id);
    const tokenBalance = account.balance.getAndRequireEquals();
    tokenBalance.assertEquals(balance);
    const app = new Counter(address);
    const key = app.counter.getAndRequireEquals();
    key.assertEquals(balance);
    app.increaseCounter();
    this.token.mint({ address, amount: 1 });
  }
}
*/

export class Escrow extends SmartContract {
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
  }

  @method deposit(user: PublicKey) {
    // add your deposit logic circuit here
    // that will adjust the amount

    const payerUpdate = AccountUpdate.create(user);
    payerUpdate.requireSignature();
    payerUpdate.send({ to: this.address, amount: UInt64.from(1000000) });
  }

  @method withdraw(user: PublicKey) {
    // add your withdrawal logic circuit here
    // that will adjust the amount

    this.send({ to: user, amount: UInt64.from(1000000) });
  }
}

let escrow: PublicKey | undefined = undefined;
let escrowPrivateKey: PrivateKey | undefined = undefined;

beforeAll(async () => {
  if (useLocalBlockchain) {
    const Local = await Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);
    const { privateKey } = Local.testAccounts[0];
    deployer = privateKey;
    const { privateKey: userKey } = Local.testAccounts[1];
    user = userKey;
  } else {
    const network = Mina.Network({
      mina: MINAURL,
      archive: ARCHIVEURL,
    });
    Mina.setActiveInstance(network);
    deployer = PrivateKey.fromBase58(DEPLOYER);
  }
  await Escrow.compile();
});

describe("Deposit and withdraw", () => {
  it("should deploy an Escrow contract", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;

    const sender = deployer.toPublicKey();
    const zkAppPrivateKey = PrivateKey.random();
    const zkAppPublicKey = zkAppPrivateKey.toPublicKey();

    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppPublicKey });

    const zkApp = new Escrow(zkAppPublicKey);
    const transaction = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkApp.deploy({});
      }
    );
    await transaction.prove();
    transaction.sign([deployer, zkAppPrivateKey]);
    const tx = await transaction.send();
    console.log(
      `deploying the Escrow contract to an address ${zkAppPublicKey.toBase58()}
using the deployer with public key ${sender.toBase58()}:
`
      //transaction.toPretty()
    );
    if (!useLocalBlockchain) {
      await tx.wait({ maxAttempts: 120, interval: 60000 });
    }
    escrow = zkAppPublicKey;
    escrowPrivateKey = zkAppPrivateKey;
  });

  it("should deposit and check the balance", async () => {
    expect(deployer).not.toBeUndefined();
    expect(escrow).not.toBeUndefined();
    expect(user).not.toBeUndefined();

    if (deployer === undefined || escrow === undefined || user === undefined)
      return;
    const zkApp = new Escrow(escrow);

    const sender = user.toPublicKey();
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: escrow });
    const balanceBefore = await accountBalance(escrow);

    const transaction = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        zkApp.deposit(sender);
      }
    );
    await transaction.prove();
    expect(escrowPrivateKey).not.toBeUndefined();
    if (escrowPrivateKey === undefined) return;
    transaction.sign([user]);
    const tx = await transaction.send();
    if (!useLocalBlockchain) {
      await tx.wait({ maxAttempts: 120, interval: 60000 });
    }
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: escrow });
    const balanceAfter = await accountBalance(escrow);
    expect(balanceAfter.toBigInt()).toBe(
      balanceBefore.add(UInt64.from(1000000)).toBigInt()
    );
  });
});
