export { MinaNFTBadge, MinaNFTBadgeConstructor };
import {
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  MerkleMap,
  Signature,
  Account,
  Field,
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
import { sleep } from "./mina";
import { fetchMinaAccount } from "./fetch";

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
  tokenSymbol: string;
  verifiedKey: string;
  verifiedKind: string;
  oracle: PublicKey;
  address?: PublicKey;
}

class MinaNFTBadge {
  name: string;
  owner: string;
  tokenSymbol: string;
  verifiedKey: string;
  verifiedKind: string;
  oracle: PublicKey;
  address?: PublicKey;

  /**
   * Create MinaNFT object
   * @param args {@link MinaNFTBadgeConstructor}
   */
  constructor(args: MinaNFTBadgeConstructor) {
    if (args.name.length > 30)
      throw new Error("Badge name too long, must be maximum 30 character");
    this.name = args.name;
    if (args.owner.length > 30)
      throw new Error("Badge owner too long, must be maximum 30 character");
    this.owner = args.owner;
    if (args.verifiedKey.length > 30)
      throw new Error(
        "Badge verifiedKey too long, must be maximum 30 character"
      );
    this.verifiedKey = args.verifiedKey;
    if (args.verifiedKind.length > 30)
      throw new Error(
        "Badge verifiedKind too long, must be maximum 30 character"
      );
    this.verifiedKind = args.verifiedKind;
    this.oracle = args.oracle;
    this.address = args.address;
    if (args.tokenSymbol.length > 6)
      throw new Error("Token symbol too long, must be maximum 6 characters");
    this.tokenSymbol = args.tokenSymbol;
  }

  public static async fromPublicKey(
    badgePublicKey: PublicKey
  ): Promise<MinaNFTBadge | undefined> {
    const zkApp = new MinaNFTVerifierBadge(badgePublicKey);
    await fetchMinaAccount({ publicKey: badgePublicKey });
    if (!Mina.hasAccount(badgePublicKey)) return undefined;
    const name = zkApp.name.get();
    const owner = zkApp.owner.get();
    const verifiedKey = zkApp.verifiedKey.get();
    const verifiedKind = zkApp.verifiedKind.get();
    const oracle = zkApp.oracle.get();
    // eslint-disable-next-line @typescript-eslint/no-inferrable-types
    const tokenSymbol: string = "BADGE";
    return new MinaNFTBadge({
      name: MinaNFT.stringFromField(name),
      owner: MinaNFT.stringFromField(owner),
      verifiedKey: MinaNFT.stringFromField(verifiedKey),
      verifiedKind: MinaNFT.stringFromField(verifiedKind),
      oracle,
      address: badgePublicKey,
      tokenSymbol,
    });
  }

  public async deploy(
    deployer: PrivateKey,
    privateKey: PrivateKey | undefined = undefined,
    nonce?: number
  ): Promise<Mina.PendingTransaction | undefined> {
    const sender = deployer.toPublicKey();
    const zkAppPrivateKey = privateKey ?? PrivateKey.random();
    const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    await MinaNFT.compileBadge();
    console.log(
      `deploying the MinaNFTVerifierBadge contract to an address ${zkAppPublicKey.toBase58()} using the deployer with public key ${sender.toBase58()}...`
    );
    await fetchMinaAccount({ publicKey: sender });
    await fetchMinaAccount({ publicKey: zkAppPublicKey });
    const deployNonce = nonce ?? Number(Account(sender).nonce.get().toBigint());
    const hasAccount = Mina.hasAccount(zkAppPublicKey);

    const zkApp = new MinaNFTVerifierBadge(zkAppPublicKey);
    const transaction = await Mina.transaction(
      {
        sender,
        fee: await MinaNFT.fee(),
        memo: "minanft.io",
        nonce: deployNonce,
      },
      () => {
        if (!hasAccount) AccountUpdate.fundNewAccount(sender);
        zkApp.deploy({});
        zkApp.name.set(MinaNFT.stringToField(this.name));
        zkApp.owner.set(MinaNFT.stringToField(this.owner));
        zkApp.verifiedKey.set(MinaNFT.stringToField(this.verifiedKey));
        zkApp.verifiedKind.set(MinaNFT.stringToField(this.verifiedKind));
        zkApp.oracle.set(this.oracle);
        zkApp.account.tokenSymbol.set(this.tokenSymbol);
        zkApp.account.zkappUri.set("https://minanft.io/" + this.name);
      }
    );
    transaction.sign([deployer, zkAppPrivateKey]);
    const tx = await transaction.send();
    await MinaNFT.transactionInfo(tx, "badge deploy", false);
    if (tx.status === "pending") {
      this.address = zkAppPublicKey;
      return tx;
    } else return undefined;
  }

  public async issue(
    deployer: PrivateKey,
    nft: MinaNFT,
    oraclePrivateKey: PrivateKey,
    nonce?: number
  ): Promise<Mina.PendingTransaction | undefined> {
    if (this.address === undefined) {
      throw new Error("Badge not deployed");
    }
    if (nft.address === undefined) {
      throw new Error("NFT not deployed");
    }
    if (nft.tokenId === undefined) throw new Error("NFT tokenId not set");
    const nftTokenId: Field = nft.tokenId;
    const nftAddress: PublicKey = nft.address;
    await MinaNFT.compileBadge();
    //console.log("Creating proofs for", verifiedKey);
    const logStr = `Badge proofs created for ${
      nft.name
    } ${nft.version.toJSON()}`;
    console.time(logStr);
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
    const privateData = nft.getMetadata(this.verifiedKey);
    if (privateData === undefined) throw new Error("Metadata not found");
    const nftdata: Metadata = new Metadata({
      data: privateData.data,
      kind: privateData.kind,
    });
    const badgeEvent: MinaNFTVerifierBadgeEvent = new MinaNFTVerifierBadgeEvent(
      {
        address: nftAddress,
        owner: nft.owner,
        name: MinaNFT.stringToField(nft.name),
        version: nft.version,
        data: nftdata,
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

    console.timeEnd(logStr);
    const sender = deployer.toPublicKey();

    await fetchMinaAccount({ publicKey: sender });
    await fetchMinaAccount({ publicKey: nftAddress, tokenId: nftTokenId });
    await fetchMinaAccount({ publicKey: this.address });
    await fetchMinaAccount({ publicKey: nftAddress, tokenId });
    const hasAccount = Mina.hasAccount(nftAddress, tokenId);
    const deployNonce = nonce ?? Number(Account(sender).nonce.get().toBigint());

    const hasNftAccount = Mina.hasAccount(nftAddress, nftTokenId);
    if (!hasNftAccount) throw new Error("NFT account not found");
    const zkAppNFT = new MinaNFTContract(nftAddress, nftTokenId);
    const version = zkAppNFT.version.get();
    console.log("Issuing badge for", nft.name, "version", version.toJSON());

    const transaction = await Mina.transaction(
      {
        sender,
        fee: await MinaNFT.fee(),
        memo: "minanft.io",
        nonce: deployNonce,
      },
      () => {
        if (!hasAccount) AccountUpdate.fundNewAccount(sender);
        issuer.issueBadge(
          nftAddress,
          nftTokenId,
          badgeEvent,
          signature,
          redactedProof,
          badgeStateProof
        );
      }
    );
    await sleep(100); // alow GC to run
    await transaction.prove();
    transaction.sign([deployer]);
    const tx = await transaction.send();
    await MinaNFT.transactionInfo(tx, "issue badge", false);
    if (tx.status === "pending") {
      return tx;
    } else return undefined;
  }

  public async verify(nft: MinaNFT): Promise<boolean> {
    if (this.address === undefined) {
      throw new Error("Badge not deployed");
    }
    if (nft.address === undefined) {
      throw new Error("NFT not deployed");
    }
    if (nft.tokenId === undefined) throw new Error("NFT tokenId not set");
    const nftAddress: PublicKey = nft.address;
    const issuer = new MinaNFTVerifierBadge(this.address);
    const tokenId = issuer.token.id;
    const zkNFT = new MinaNFTContract(nftAddress, nft.tokenId);
    await fetchMinaAccount({ publicKey: nftAddress, tokenId });
    await fetchMinaAccount({ publicKey: nftAddress, tokenId: nft.tokenId });
    const hasAccount = Mina.hasAccount(nftAddress, tokenId);
    if (!hasAccount) return false;
    const version = zkNFT.version.get();
    const balance = Mina.getBalance(nftAddress, tokenId);
    return version.equals(balance).toBoolean();
  }
}
