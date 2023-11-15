import { describe, expect, it } from "@jest/globals";
import {
  method,
  SmartContract,
  AccountUpdate,
  fetchAccount,
  PrivateKey,
  Mina,
  PublicKey,
  state,
  State,
  Field,
  Bool,
  Permissions,
  DeployArgs,
  VerificationKey,
} from "o1js";

// Private key of the deployer:
import { DEPLOYER } from "../env.json";

// True - local blockchain, false - Berkeley
const useLocalBlockchain: boolean = false;

const MINAURL = "https://proxy.berkeley.minaexplorer.com/graphql";
const ARCHIVEURL = "https://archive.berkeley.minaexplorer.com";
const TESTWORLD2 = "https://proxy.testworld.minaexplorer.com/graphql";
const TESTWORLD2_ARCHIVE = "https://archive.testworld.minaexplorer.com";
const tokenSymbol = "TEST";
const transactionFee = 150_000_000;
jest.setTimeout(1000 * 60 * 60 * 10); // 10 hours
let deployer: PrivateKey | undefined = undefined;

class Token extends SmartContract {
  deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      setDelegate: Permissions.proof(),
      incrementNonce: Permissions.proof(),
      setVotingFor: Permissions.proof(),
      setTiming: Permissions.proof(),
    });
  }

  @method mint(address: PublicKey, vk: VerificationKey) {
    this.token.mint({ address, amount: 1 });
    const update = AccountUpdate.createSigned(address, this.token.id);
    update.body.update.verificationKey = { isSome: Bool(true), value: vk };
    update.body.update.permissions = {
      isSome: Bool(true),
      value: {
        ...Permissions.default(),
        setDelegate: Permissions.proof(),
        incrementNonce: Permissions.proof(),
        setVotingFor: Permissions.proof(),
        setTiming: Permissions.proof(),
      },
    };
  }

  @method update(value: Field, address: PublicKey) {
    const zkAppTokenAccount = new TokenAccount(address, this.token.id);
    zkAppTokenAccount.update(value);
  }
}

class TokenAccount extends SmartContract {
  @state(Field) value = State<Field>();

  @method update(value: Field) {
    const oldValue = this.value.getAndAssertEquals();
    oldValue.assertEquals(value.sub(Field(1)));
    this.value.set(value);
  }
}

let token: PublicKey | undefined = undefined;
let tokenPrivateKey: PrivateKey | undefined = undefined;
let user: PublicKey | undefined = undefined;
let userPrivateKey: PrivateKey | undefined = undefined;
let verificationKey: VerificationKey | undefined = undefined;

beforeAll(async () => {
  if (useLocalBlockchain) {
    const Local = Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);
    deployer = Local.testAccounts[0].privateKey;
  } else {
    const network = Mina.Network({
      mina: TESTWORLD2,
      archive: TESTWORLD2_ARCHIVE,
    });
    Mina.setActiveInstance(network);
    deployer = PrivateKey.fromBase58(DEPLOYER);
  }
  const { verificationKey: vk } = await TokenAccount.compile();
  verificationKey = vk;
  await Token.compile();
});

describe("Mint tokens", () => {
  it("should deploy a Token contract", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;

    const sender = deployer.toPublicKey();
    const zkAppTokenPrivateKey = PrivateKey.random();
    const zkAppTokenPublicKey = zkAppTokenPrivateKey.toPublicKey();
    userPrivateKey = PrivateKey.random();
    user = userPrivateKey.toPublicKey();
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppTokenPublicKey });

    const zkToken = new Token(zkAppTokenPublicKey);

    const transaction = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io" },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkToken.deploy({});
        zkToken.account.tokenSymbol.set(tokenSymbol);
      }
    );
    await transaction.prove();
    transaction.sign([deployer, zkAppTokenPrivateKey]);
    const tx = await transaction.send();
    console.log(
      `deploying the Token contract to an address ${zkAppTokenPublicKey.toBase58()}
using the deployer with public key ${sender.toBase58()}:
`
      //transaction.toPretty()
    );
    if (!useLocalBlockchain) {
      await tx.wait({ maxAttempts: 120, interval: 60000 });
    }
    token = zkAppTokenPublicKey;
    tokenPrivateKey = zkAppTokenPrivateKey;
  });

  it("should deploy the TokenAccount contract", async () => {
    expect(deployer).not.toBeUndefined();
    expect(token).not.toBeUndefined();
    expect(tokenPrivateKey).not.toBeUndefined();
    expect(user).not.toBeUndefined();
    expect(userPrivateKey).not.toBeUndefined();
    if (
      deployer === undefined ||
      tokenPrivateKey === undefined ||
      token === undefined ||
      user === undefined ||
      userPrivateKey === undefined
    )
      return;
    const userPublicKey: PublicKey = user;
    const zkToken = new Token(token!);
    const sender = deployer.toPublicKey();
    const transaction = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io" },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkToken.mint(userPublicKey, verificationKey!);
      }
    );
    await transaction.prove();
    transaction.sign([deployer, userPrivateKey]);
    const tx = await transaction.send();
    console.log(`deploying the TokenAccount`);
    if (!useLocalBlockchain) {
      await tx.wait({ maxAttempts: 120, interval: 60000 });
    }
  });

  it("should change the state and check the balance", async () => {
    expect(deployer).not.toBeUndefined();
    expect(token).not.toBeUndefined();
    expect(tokenPrivateKey).not.toBeUndefined();
    expect(user).not.toBeUndefined();
    expect(userPrivateKey).not.toBeUndefined();
    if (
      deployer === undefined ||
      tokenPrivateKey === undefined ||
      token === undefined ||
      user === undefined ||
      userPrivateKey === undefined
    )
      return;
    const userPublicKey: PublicKey = user;
    const zkToken = new Token(token);
    const tokenId = zkToken.token.id;
    const zkTokenAccount = new TokenAccount(userPublicKey!, tokenId);

    const sender = deployer.toPublicKey();

    for (let i = 0; i < 10; i++) {
      await fetchAccount({ publicKey: sender });
      await fetchAccount({ publicKey: token });
      await fetchAccount({ publicKey: userPublicKey });
      await fetchAccount({ publicKey: userPublicKey, tokenId });
      const hasAccount = Mina.hasAccount(userPublicKey, tokenId);
      const value = zkTokenAccount.value.get();
      console.log(
        "Iteration",
        i,
        "hasAccount",
        hasAccount,
        "value",
        value.toJSON()
      );
      expect(value).toBeDefined();
      expect(value.toJSON()).toBe(i.toString());

      const transaction = await Mina.transaction(
        { sender, fee: transactionFee, memo: "minanft.io" },
        () => {
          zkToken.update(Field(i + 1 + (i == 2 ? 1 : 0)), userPublicKey);
        }
      );
      await transaction.prove();
      transaction.sign([deployer]);
      const tx = await transaction.send();
      //console.log(`Transaction ${i}:`, transaction.toPretty());
      if (!useLocalBlockchain) {
        await tx.wait({ maxAttempts: 120, interval: 60000 });
      }
    }
  });
});
