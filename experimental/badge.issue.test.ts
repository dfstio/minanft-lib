import { describe, expect, it } from "@jest/globals";
import fs from "fs/promises";
import {
  Field,
  AccountUpdate,
  fetchAccount,
  PrivateKey,
  Mina,
  PublicKey,
  UInt64,
  Poseidon,
  JsonProof,
  SmartContract,
  state,
  State,
  method,
  MerkleMap,
  Signature,
} from "o1js";
import { MINAURL } from "../src/config.json";
import { DEPLOYER } from "../env.json";
import { MinaNFT } from "../src/minanft";
import { Metadata, MetadataWitness } from "../src/contract/metadata";
import { RedactedMinaNFTMapStateProof } from "../src/plugins/redactedmap";
import { proof } from "../badgeproof.json";
import { nft, key } from "../nft.json";
import { BADGE, ORACLE } from "../badge.json";
import {
  MinaNFTBadge,
  BadgeDataWitness,
  BadgeData,
} from "../src/plugins/badgeproof";
import {
  MinaNFTVerifierBadge,
  MinaNFTVerifierBadgeEvent,
} from "../src/plugins/badge";

const transactionFee = 150_000_000;

jest.setTimeout(1000 * 60 * 60); // 1 hour

let deployer: PrivateKey | undefined = undefined;
const useLocal: boolean = false;
let badge: PublicKey | undefined = undefined;

class Key extends SmartContract {
  @state(Field) key = State<Field>();

  @method mint(key: Field) {
    this.key.assertEquals(Field(0));
    this.key.set(key);
  }
}

beforeAll(async () => {
  if (useLocal) {
    const Local = Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);
    const { privateKey } = Local.testAccounts[0];
    deployer = privateKey;
  } else {
    const network = Mina.Network(MINAURL);
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
  console.time("compiled");
  await Key.compile(); // If this is not compiled, the next compilation will fail. Contaract Key is not used in this test.
  //console.log("Compiling RedactedMinaNFTMapCalculation");
  //await MinaNFT.compileRedactedMap(); // Succeed only if compiled after any other contract
  console.log("Compiling MinaNFTVBadge");
  /*
  const { verificationKey } = await MinaNFTBadge.compile();
  await fs.writeFile(
    "verificationkey.json",
    JSON.stringify({ verificationKey })
  );
  */
  console.log("Compiling MinaNFTVerifierBadge");
  await MinaNFTVerifierBadge.compile();
  console.timeEnd("compiled");
});

describe("Badge issuing", () => {
  it("should issue badge", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;
    expect(nft).not.toBeUndefined();
    if (nft === undefined) return;
    expect(proof).not.toBeUndefined();
    if (proof === undefined) return;
    expect(BADGE).not.toBeUndefined();
    if (BADGE === undefined) return;
    badge = PublicKey.fromBase58(BADGE);
    expect(badge).not.toBeUndefined();
    if (badge === undefined) return;

    const redactedProof: RedactedMinaNFTMapStateProof =
      RedactedMinaNFTMapStateProof.fromJSON(proof as JsonProof);
    expect(redactedProof.publicInput.count.toJSON()).toBe(Field(1).toJSON());
    /*
    class MinaNFTVerifierBadgeEvent extends Struct({
        address: PublicKey,
        owner: Field,
        name: Field,
        data: Metadata,
        key: Field,
    */
    const badgeEvent: MinaNFTVerifierBadgeEvent = new MinaNFTVerifierBadgeEvent(
      {
        address: PublicKey.fromBase58(nft),
        owner: Poseidon.hash(
          PrivateKey.fromBase58(key).toPublicKey().toFields()
        ),
        name: MinaNFT.stringToField("@builder"),
        data: {
          data: MinaNFT.stringToField("@builder"),
          kind: MinaNFT.stringToField("string"),
        } as Metadata,
        key: MinaNFT.stringToField("twitter"),
      }
    );
    /*
    class BadgeDataWitness extends Struct({
          root: Metadata,
          value: Metadata,
          key: Field,
          witness: MetadataWitness,
        }) {}
*/
    const data: MerkleMap = new MerkleMap();
    const kind: MerkleMap = new MerkleMap();
    data.set(badgeEvent.key, badgeEvent.data.data);
    kind.set(badgeEvent.key, badgeEvent.data.kind);

    const badgeDataWitness: BadgeDataWitness = {
      root: {
        data: data.getRoot(),
        kind: kind.getRoot(),
      } as Metadata,
      value: badgeEvent.data,
      key: badgeEvent.key,
      witness: {
        data: data.getWitness(badgeEvent.key),
        kind: kind.getWitness(badgeEvent.key),
      } as MetadataWitness,
    };
    expect(badgeDataWitness.root.data.toJSON()).toBe(
      redactedProof.publicInput.redactedRoot.data.toJSON()
    );
    expect(badgeDataWitness.root.kind.toJSON()).toBe(
      redactedProof.publicInput.redactedRoot.kind.toJSON()
    );
    const badgeState = BadgeData.create(badgeDataWitness);
    const badgeStateProof = await MinaNFTBadge.create(
      badgeState,
      badgeDataWitness
    );
    const signature = Signature.create(
      PrivateKey.fromBase58(ORACLE),
      badgeEvent.toFields()
    );

    const nftAddress = PublicKey.fromBase58(nft);
    const issuer = new MinaNFTVerifierBadge(badge);
    const tokenId = issuer.token.id;

    const sender = deployer.toPublicKey();
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: nftAddress });
    await fetchAccount({ publicKey: badge });
    await fetchAccount({ publicKey: nftAddress, tokenId });
    let hasAccount = Mina.hasAccount(nftAddress, tokenId);

    const transaction = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        if (!hasAccount) AccountUpdate.fundNewAccount(sender);
        issuer.issueBadge(
          nftAddress,
          badgeEvent,
          signature,
          redactedProof,
          badgeStateProof
        );
      }
    );
    await transaction.prove();
    transaction.sign([deployer]);
    const tx = await transaction.send();
    console.log(`Transaction:`, transaction.toPretty());
    if (!useLocal) {
      await tx.wait({ maxAttempts: 120, interval: 60000 });
    }
    console.log(`Fetching accounts...`);
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: nftAddress });
    await fetchAccount({ publicKey: badge });
    await fetchAccount({ publicKey: nftAddress, tokenId });
    hasAccount = Mina.hasAccount(nftAddress, tokenId);
    if (hasAccount) {
      const balance = Mina.getBalance(nftAddress, tokenId);
      console.log("Balance:", balance.toString());
      expect(balance.toBigInt()).toEqual(BigInt(1));
    }
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
