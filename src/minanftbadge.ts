export { MinaNFTBadge, MinaNFTBadgeConstructor };
import {
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  fetchAccount,
  MerkleMap,
  Signature,
} from "o1js";
import { MinaNFT } from "./minanft";
import { Metadata, MetadataWitness } from "./contract/metadata";
import {
  MinaNFTBadgeCalculation,
  BadgeData,
  BadgeDataWitness,
} from "./plugins/badgeproof";
import {
  MinaNFTVerifierBadgeEvent,
  MinaNFTVerifierBadge,
} from "./plugins/badge";
import { RedactedMinaNFT } from "./redactedminanft";
import { MinaNFTContract } from "./contract/nft";

/**
 * interface for MinaNFTBadge constructor
 * @param name Name of the Badge issuer
 * @param owner Name of the Badge owner
 * @param verifiedKey Key of the Badge that is verified (like "twitter")
 * @param verifiedKind Kind of the Badge that is verified (like "string")
 * @param oracle Oracle public key that verifies the Badge
 *
 */
interface MinaNFTBadgeConstructor {
  name: string;
  owner: string;
  verifiedKey: string;
  verifiedKind: string;
  oracle: PublicKey;
  address?: PublicKey;
}

class MinaNFTBadge {
  name: string;
  owner: string;
  verifiedKey: string;
  verifiedKind: string;
  oracle: PublicKey;
  address?: PublicKey;

  /**
   * Create MinaNFT object
   * @param name Name of NFT
   * @param zkAppPublicKey Public key of the deployed NFT zkApp
   */
  constructor(args: MinaNFTBadgeConstructor) {
    this.name = args.name;
    this.owner = args.owner;
    this.verifiedKey = args.verifiedKey;
    this.verifiedKind = args.verifiedKind;
    this.oracle = args.oracle;
    this.address = args.address;
  }

  public static async fromPublicKey(
    badgePublicKey: PublicKey
  ): Promise<MinaNFTBadge | undefined> {
    const zkApp = new MinaNFTVerifierBadge(badgePublicKey);
    await fetchAccount({ publicKey: badgePublicKey });
    if (!Mina.hasAccount(badgePublicKey)) return undefined;
    const name = zkApp.name.get();
    const owner = zkApp.owner.get();
    const verifiedKey = zkApp.verifiedKey.get();
    const verifiedKind = zkApp.verifiedKind.get();
    const oracle = zkApp.oracle.get();
    return new MinaNFTBadge({
      name: MinaNFT.stringFromField(name),
      owner: MinaNFT.stringFromField(owner),
      verifiedKey: MinaNFT.stringFromField(verifiedKey),
      verifiedKind: MinaNFT.stringFromField(verifiedKind),
      oracle,
      address: badgePublicKey,
    });
  }

  public async deploy(
    deployer: PrivateKey
  ): Promise<Mina.TransactionId | undefined> {
    const sender = deployer.toPublicKey();
    const zkAppPrivateKey = PrivateKey.random();
    const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    await MinaNFT.compileBadge();
    console.log(
      `deploying the MinaNFTVerifierBadge contract to an address ${zkAppPublicKey.toBase58()} using the deployer with public key ${sender.toBase58()}...`
    );
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppPublicKey });

    const zkApp = new MinaNFTVerifierBadge(zkAppPublicKey);
    const transaction = await Mina.transaction(
      { sender, fee: await MinaNFT.fee(), memo: "minanft.io" },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkApp.deploy({});
        zkApp.name.set(MinaNFT.stringToField(this.name));
        zkApp.owner.set(MinaNFT.stringToField(this.owner));
        zkApp.verifiedKey.set(MinaNFT.stringToField(this.verifiedKey));
        zkApp.verifiedKind.set(MinaNFT.stringToField(this.verifiedKind));
        zkApp.oracle.set(this.oracle);
      }
    );
    transaction.sign([deployer, zkAppPrivateKey]);
    const tx = await transaction.send();
    await MinaNFT.transactionInfo(tx, "badge deploy", false);
    if (tx.isSuccess) {
      this.address = zkAppPublicKey;
      return tx;
    } else return undefined;
  }

  public async issue(
    deployer: PrivateKey,
    nft: MinaNFT,
    oraclePrivateKey: PrivateKey
  ): Promise<Mina.TransactionId | undefined> {
    if (this.address === undefined) {
      throw new Error("Badge not deployed");
    }
    if (nft.zkAppPublicKey === undefined) {
      throw new Error("NFT not deployed");
    }
    const nftAddress: PublicKey = nft.zkAppPublicKey;
    await MinaNFT.compileBadge();
    //console.log("Creating proofs for", verifiedKey);
    console.time("Badge proofs created");
    const disclosure = new RedactedMinaNFT(nft);
    disclosure.copyMetadata(this.verifiedKey);
    const redactedProof = await disclosure.proof();
    /*
        class MinaNFTVerifierBadgeEvent extends Struct({
          address: PublicKey,
          owner: Field,
          name: Field,
          version: UInt64,
          data: Metadata,
          key: Field,
        })
    */
    const badgeEvent: MinaNFTVerifierBadgeEvent = new MinaNFTVerifierBadgeEvent(
      {
        address: nftAddress,
        owner: nft.owner,
        name: MinaNFT.stringToField(nft.name),
        version: nft.version,
        data: nft.getMetadata(this.verifiedKey),
        key: MinaNFT.stringToField(this.verifiedKey),
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
    if (
      badgeDataWitness.root.data.toJSON() !==
      redactedProof.publicInput.redactedRoot.data.toJSON()
    ) {
      throw new Error("Data root mismatch");
    }
    if (
      badgeDataWitness.root.kind.toJSON() !==
      redactedProof.publicInput.redactedRoot.kind.toJSON()
    ) {
      throw new Error("Kind root mismatch");
    }
    const badgeState = BadgeData.create(badgeDataWitness);
    const badgeStateProof = await MinaNFTBadgeCalculation.create(
      badgeState,
      badgeDataWitness
    );
    const signature = Signature.create(oraclePrivateKey, badgeEvent.toFields());

    const issuer = new MinaNFTVerifierBadge(this.address);
    const tokenId = issuer.token.id;

    console.timeEnd("Badge proofs created");
    const sender = deployer.toPublicKey();

    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: nftAddress });
    await fetchAccount({ publicKey: this.address });
    await fetchAccount({ publicKey: nftAddress, tokenId });
    const hasAccount = Mina.hasAccount(nftAddress, tokenId);

    const transaction = await Mina.transaction(
      { sender, fee: await MinaNFT.fee(), memo: "minanft.io" },
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
    await MinaNFT.transactionInfo(tx, "issue badge", false);
    if (tx.isSuccess) {
      return tx;
    } else return undefined;
  }

  public async verify(nft: MinaNFT): Promise<boolean> {
    if (this.address === undefined) {
      throw new Error("Badge not deployed");
    }
    if (nft.zkAppPublicKey === undefined) {
      throw new Error("NFT not deployed");
    }
    const nftAddress: PublicKey = nft.zkAppPublicKey;
    const issuer = new MinaNFTVerifierBadge(this.address);
    const tokenId = issuer.token.id;
    const zkNFT = new MinaNFTContract(nftAddress);
    await fetchAccount({ publicKey: nftAddress, tokenId });
    const hasAccount = Mina.hasAccount(nftAddress, tokenId);
    if (!hasAccount) return false;
    await fetchAccount({ publicKey: nftAddress });
    const version = zkNFT.version.get();
    const balance = Mina.getBalance(nftAddress, tokenId);
    return version.equals(balance).toBoolean();
  }
}
