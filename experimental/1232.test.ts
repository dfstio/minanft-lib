import {
  AccountUpdate,
  Bool,
  ZkProgram,
  Mina,
  PrivateKey,
  PublicKey,
  SmartContract,
  State,
  UInt64,
  method,
  state,
  fetchAccount,
} from "o1js";

const MyProof = ZkProgram({
  name: "MyProof",
  methods: {
    make: {
      privateInputs: [UInt64],

      method(value: UInt64) {
        const expected = UInt64.from(34);
        value.assertEquals(expected);
      },
    },
  },
});

class BrokenProof extends ZkProgram.Proof(MyProof) {}
class Broken extends SmartContract {
  @state(Bool) isValid = State<Bool>();

  init() {
    super.init();
    this.isValid.set(Bool(false));
  }

  @method setValid(proof: BrokenProof) {
    proof.verify();
    this.isValid.set(Bool(true));
  }
}

describe("Broken", () => {
  let deployerAccount: PublicKey;
  let deployerKey: PrivateKey;
  let senderAccount: PublicKey;
  let senderKey: PrivateKey;
  let zkAppAddress: PublicKey;
  let zkAppPrivateKey: PrivateKey;
  let zkApp: Broken;

  beforeAll(async () => {
    await MyProof.compile();
    await Broken.compile();
  });

  beforeEach(() => {
    const Local = Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);
    ({ privateKey: deployerKey, publicKey: deployerAccount } =
      Local.testAccounts[0]);
    ({ privateKey: senderKey, publicKey: senderAccount } =
      Local.testAccounts[1]);
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkApp = new Broken(zkAppAddress);
  });

  async function localDeploy() {
    const txn = await Mina.transaction(deployerAccount, () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      zkApp.deploy();
    });
    await txn.prove();
    await txn.sign([deployerKey, zkAppPrivateKey]).send();
  }

  it("accepts a proof", async () => {
    await localDeploy();

    const value = UInt64.from(34);
    const proof = await MyProof.make(value);

    // update transaction
    await fetchAccount({ publicKey: zkAppAddress });
    await fetchAccount({ publicKey: senderAccount });
    const txn = await Mina.transaction(senderAccount, () => {
      zkApp.setValid(proof);
    });
    await txn.prove();
    await txn.sign([senderKey]).send();

    await fetchAccount({ publicKey: zkAppAddress });
    const isValid = zkApp.isValid.get();
    expect(isValid.toBoolean()).toEqual(true);
  });
});
