import { describe, expect, it } from "@jest/globals";
import {
  SmartContract,
  method,
  Struct,
  DeployArgs,
  Permissions,
  Mina,
  PrivateKey,
  fetchAccount,
  AccountUpdate,
  PublicKey,
  provable,
} from "o1js";

// Private key of the deployer:
import { DEPLOYER } from "../env.json";

// True - local blockchain, false - Berkeley
const useLocalBlockchain: boolean = false;

const MINAURL = "https://proxy.berkeley.minaexplorer.com/graphql";
const ARCHIVEURL = "https://archive.berkeley.minaexplorer.com";
jest.setTimeout(1000 * 60 * 60 * 10); // 10 hours
const transactionFee = 150_000_000;
let deployer: PrivateKey | undefined = undefined;
let zkAppPublicKey: PublicKey | undefined = undefined;

//class URIString extends Struct({ uri: String }) {}

class URIString extends Struct({
  ...provable({ data: String }),
  toJSON({ data }: { data: string }) {
    return data;
  },
}) {}

class URI extends SmartContract {
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

  @method setURI(zkUri: URIString) {
    this.account.zkappUri.set(zkUri.data);
  }
}

beforeAll(async () => {
  if (useLocalBlockchain) {
    const Local = Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);
    const { privateKey } = Local.testAccounts[0];
    deployer = privateKey;
  } else {
    const network = Mina.Network({
      mina: MINAURL,
      archive: ARCHIVEURL,
    });
    Mina.setActiveInstance(network);
    deployer = PrivateKey.fromBase58(DEPLOYER);
  }
  console.time("compiled");
  console.log("Compiling URI");
  await URI.compile();
  console.timeEnd("compiled");
});

describe("Set and change zkAppUri", () => {
  it("should deploy the contract and set zkAppUri", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;

    const sender = deployer.toPublicKey();
    const zkAppPrivateKey = PrivateKey.random();
    zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppPublicKey });

    const zkApp = new URI(zkAppPublicKey);
    const transaction = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkApp.deploy({});
        zkApp.account.zkappUri.set("https://zkapp1.io");
      }
    );
    await transaction.prove();
    transaction.sign([deployer, zkAppPrivateKey]);
    const tx = await transaction.send();
    console.log(
      `deploying the URI contract to an address ${zkAppPublicKey.toBase58()}
using the deployer with public key ${sender.toBase58()}:
`,
      transaction.toPretty()
    );
    if (!useLocalBlockchain) {
      await tx.wait({ maxAttempts: 120, interval: 60000 });
    }
    const account = await fetchAccount({ publicKey: zkAppPublicKey });
    const uri = account.account?.zkapp?.zkappUri;
    if (!useLocalBlockchain) {
      expect(uri).not.toBeUndefined();
      expect(uri).toBe("https://zkapp1.io");
    }
    //  {data: uri.data, hash: uri.hash} as MetadataURI;
  });

  it("should change zkAppUri", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;
    expect(zkAppPublicKey).not.toBeUndefined();
    if (zkAppPublicKey === undefined) return;

    const sender = deployer.toPublicKey();
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppPublicKey });

    const zkApp = new URI(zkAppPublicKey);
    const zkUri: URIString = { data: String("https://zkapp2.io") } as URIString;

    const transaction = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        zkApp.setURI(zkUri);
      }
    );
    await transaction.prove();
    transaction.sign([deployer]);
    const tx = await transaction.send();
    console.log(`Changing zkAppUri`, transaction.toPretty());
    if (!useLocalBlockchain) {
      await tx.wait({ maxAttempts: 120, interval: 60000 });
    }
    const account = await fetchAccount({ publicKey: zkAppPublicKey });
    const uri = account.account?.zkapp?.zkappUri;
    if (!useLocalBlockchain) {
      expect(uri).not.toBeUndefined();
      expect(uri).toBe("https://zkapp2.io");
    }
  });
});
