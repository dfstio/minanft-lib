import {
  Bool,
  Field,
  MerkleMap,
  MerkleMapWitness,
  Poseidon,
  Provable,
  PublicKey,
  Reducer,
  Signature,
  SmartContract,
  State,
  Struct,
  UInt64,
  UInt8,
  Unconstrained,
  method,
  state,
  provable,
  Mina,
  PrivateKey,
  Scalar,
  AccountUpdate,
} from "o1js";
// import { provableTuple } from 'src/lib/circuit-value.js';

class PassportData extends Struct({
  country: UInt8,
  birthdate: UInt64,
  expiry: UInt64,
}) {}

type Tuple = [any, ...any];

class PassportHolders extends SmartContract {
  @state(Field) passportHoldersRoot = State<Field>();
  @state(Field) currentActionState = State<Field>();

  reducer = Reducer({ actionType: provable([Field, Field] satisfies Tuple) });

  events = {
    "passport-holder-birth-date": UInt64,
  };

  init() {
    this.passportHoldersRoot.set(new MerkleMap().getRoot());
    this.currentActionState.set(Reducer.initialActionState);
  }

  @method register(
    address: PublicKey,
    passportData: PassportData,
    govSignature: Signature
  ) {
    // verify passport
    verifyValidPassport(passportData, govSignature);

    // create merkle map key and new value
    // TODO protect this hash from brute-forcing
    let key = Poseidon.hashPacked(PassportData, passportData);
    let value = Poseidon.hashPacked(PublicKey, address);

    // publish key and value
    this.reducer.dispatch([key, value]);
  }

  @method reduceRegister(passportHoldersMap: Unconstrained<MerkleMap>) {
    let initialRoot = this.passportHoldersRoot.getAndRequireEquals();
    let initialActionState = this.currentActionState.getAndRequireEquals();
    let actions = this.reducer.getActions({
      fromActionState: initialActionState,
    });

    let { state: newRoot, actionState: newActionState } = this.reducer.reduce(
      actions,
      Field,
      (oldRoot, [key, value]) => {
        // create a merkle map witness/path/proof
        let path = Provable.witness(MerkleMapWitness, () => {
          let map = passportHoldersMap.get();
          let path = map.getWitness(key);
          let current = map.get(key).toBigInt();
          if (current === 0n && key.toBigInt() !== 0n) map.set(key, value);
          return path;
        });

        // check that we have the right merkle path
        const emptyValue = Field(0);
        let [impliedRoot, impliedKey] = path.computeRootAndKeyV2(emptyValue);
        impliedKey.assertEquals(key);
        let isEmpty = oldRoot.equals(impliedRoot);

        // update root with merkle path + new value
        // still works if (key, value) = (0, 0) bc new root is the same as old
        let [newRoot, _] = path.computeRootAndKeyV2(value);

        return Provable.if(isEmpty, newRoot, oldRoot);
      },
      { state: initialRoot, actionState: initialActionState },
      {
        // FIXME with new version
        // useRecursion: true,
        maxTransactionsWithActions: 5,
      }
    );

    this.passportHoldersRoot.set(newRoot);
    this.currentActionState.set(newActionState);
  }

  @method assertPassportHolder(
    passportData: PassportData,
    address: PublicKey,
    // TODO would be nice to fetch witness here
    witness: MerkleMapWitness
  ) {
    // create merkle map key and new value
    let key = Poseidon.hashPacked(PassportData, passportData);
    let value = Poseidon.hashPacked(PublicKey, address);

    // check merkle map inclusion
    let root = this.passportHoldersRoot.getAndRequireEquals();
    let [impliedRoot, impliedKey] = witness.computeRootAndKeyV2(value);
    impliedKey.assertEquals(key);
    impliedRoot.assertEquals(root);

    // publish event containing birth date
    this.emitEvent("passport-holder-birth-date", passportData.birthdate);
  }
}

class Voting extends SmartContract {
  @state(Field) yesVotes = State<Field>();
  @state(Field) noVotes = State<Field>();

  @method vote(
    passportData: PassportData,
    address: PublicKey,
    // TODO would be nice to not have to pass witness here
    witness: MerkleMapWitness,
    voteYes: Bool
  ) {
    let passportContract = new PassportHolders(passportZkappKeys.publicKey);
    passportContract.assertPassportHolder(passportData, address, witness);

    // check allowed age
    let timestamp = this.network.timestamp.getAndRequireEquals();
    let allowedMinimumDate = timestamp.sub(18 * 365 * 24 * 3600 * 1000);
    passportData.birthdate.assertLessThan(allowedMinimumDate);

    // increase votes
    let yesVotes = this.yesVotes.getAndRequireEquals();
    this.yesVotes.set(Provable.if(voteYes, yesVotes.add(1), yesVotes));
    let noVotes = this.noVotes.getAndRequireEquals();
    this.noVotes.set(Provable.if(voteYes.not(), noVotes.add(1), noVotes));
  }
}

function verifyValidPassport(data: PassportData, signature: Signature) {
  // mocked
}
