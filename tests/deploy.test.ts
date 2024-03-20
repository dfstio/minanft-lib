import { describe, expect, it } from "@jest/globals";
import { PrivateKey, PublicKey } from "o1js";

import { MinaNFT } from "../src/minanft";
import { MinaNFTEscrow } from "../src/escrow";
import { MinaNFTBadge } from "../src/minanftbadge";
import { initBlockchain, accountBalance } from "../utils/testhelpers";
import { Memory } from "../src/mina";
import {
  CONTRACT_DEPLOYER_SK,
  MINANFT_NFT_ADDRESS_SK,
  BADGE_TWITTER_SK,
  BADGE_DISCORD_SK,
  BADGE_TELEGRAM_SK,
  BADGE_GITHUB_SK,
  BADGE_LINKEDIN_SK,
  VERIFIER_SK,
  ESCROW_SK,
  BADGE_TWITTER_ORACLE_SK,
  BADGE_DISCORD_ORACLE_SK,
  BADGE_TELEGRAM_ORACLE_SK,
  BADGE_GITHUB_ORACLE_SK,
  BADGE_LINKEDIN_ORACLE_SK,
  MINANFT_NAME_SERVICE_SK,
} from "../env.json";
import config from "../src/config";
const {
  CONTRACT_DEPLOYER,
  MINANFT_NFT_ADDRESS,
  BADGE_TWITTER,
  BADGE_DISCORD,
  BADGE_TELEGRAM,
  BADGE_GITHUB,
  BADGE_LINKEDIN,
  VERIFIER,
  ESCROW,
  BADGE_TWITTER_ORACLE,
  BADGE_DISCORD_ORACLE,
  BADGE_TELEGRAM_ORACLE,
  BADGE_GITHUB_ORACLE,
  BADGE_LINKEDIN_ORACLE,
  MINANFT_NAME_SERVICE,
} = config;

// eslint-disable-next-line @typescript-eslint/no-inferrable-types
const useLocalBlockchain: boolean = true;

let deployer: PrivateKey | undefined = undefined;

beforeAll(async () => {
  const data = await initBlockchain(
    useLocalBlockchain ? "local" : "berkeley",
    0
  );
  expect(data).toBeDefined();
  if (data === undefined) return;

  const { deployer: d } = data;
  deployer = useLocalBlockchain
    ? d
    : PrivateKey.fromBase58(CONTRACT_DEPLOYER_SK);

  //MinaNFT.minaInit("testworld2");
  //deployer = PrivateKey.fromBase58(CONTRACT_DEPLOYER_SK);
  expect(deployer).toBeDefined();
  if (deployer === undefined) return;
  const balanceDeployer =
    Number((await accountBalance(deployer.toPublicKey())).toBigInt()) / 1e9;
  expect(balanceDeployer).toBeGreaterThan(15);
  if (balanceDeployer <= 15) return;
});

describe(`Deploying contracts`, () => {
  it(`should check addresses`, async () => {
    expect(deployer).toBeDefined();
    if (deployer === undefined) return;
    if (!useLocalBlockchain)
      expect(CONTRACT_DEPLOYER_SK).toBe(deployer.toBase58());
    expect(MINANFT_NFT_ADDRESS).toBe(
      PrivateKey.fromBase58(MINANFT_NFT_ADDRESS_SK).toPublicKey().toBase58()
    );
    expect(BADGE_TWITTER).toBe(
      PrivateKey.fromBase58(BADGE_TWITTER_SK).toPublicKey().toBase58()
    );
    expect(BADGE_DISCORD).toBe(
      PrivateKey.fromBase58(BADGE_DISCORD_SK).toPublicKey().toBase58()
    );
    expect(BADGE_TELEGRAM).toBe(
      PrivateKey.fromBase58(BADGE_TELEGRAM_SK).toPublicKey().toBase58()
    );
    expect(BADGE_GITHUB).toBe(
      PrivateKey.fromBase58(BADGE_GITHUB_SK).toPublicKey().toBase58()
    );
    expect(BADGE_LINKEDIN).toBe(
      PrivateKey.fromBase58(BADGE_LINKEDIN_SK).toPublicKey().toBase58()
    );
    expect(VERIFIER).toBe(
      PrivateKey.fromBase58(VERIFIER_SK).toPublicKey().toBase58()
    );
    expect(ESCROW).toBe(
      PrivateKey.fromBase58(ESCROW_SK).toPublicKey().toBase58()
    );
    expect(BADGE_TWITTER_ORACLE).toBe(
      PrivateKey.fromBase58(BADGE_TWITTER_ORACLE_SK).toPublicKey().toBase58()
    );
    expect(BADGE_DISCORD_ORACLE).toBe(
      PrivateKey.fromBase58(BADGE_DISCORD_ORACLE_SK).toPublicKey().toBase58()
    );
    expect(BADGE_TELEGRAM_ORACLE).toBe(
      PrivateKey.fromBase58(BADGE_TELEGRAM_ORACLE_SK).toPublicKey().toBase58()
    );
    expect(BADGE_GITHUB_ORACLE).toBe(
      PrivateKey.fromBase58(BADGE_GITHUB_ORACLE_SK).toPublicKey().toBase58()
    );
    expect(BADGE_LINKEDIN_ORACLE).toBe(
      PrivateKey.fromBase58(BADGE_LINKEDIN_ORACLE_SK).toPublicKey().toBase58()
    );
    expect(CONTRACT_DEPLOYER).toBe(
      PrivateKey.fromBase58(CONTRACT_DEPLOYER_SK).toPublicKey().toBase58()
    );
    expect(MINANFT_NAME_SERVICE).toBe(
      PrivateKey.fromBase58(MINANFT_NAME_SERVICE_SK).toPublicKey().toBase58()
    );
  });

  it(`should compile contracts`, async () => {
    MinaNFT.setCacheFolder("./nftcache");
    console.log(`Compiling...`);
    console.time(`compiled all`);
    await MinaNFT.compile();
    await MinaNFT.compileBadge();
    await MinaNFT.compileVerifier();
    console.timeEnd(`compiled all`);
    Memory.info(`compiled`);
  });

  /* - moved to mint.test
  it(`should mint minanft NFT`, async () => {
    expect(deployer).toBeDefined();
    if (deployer === undefined) return;
    const ownerPrivateKey = PrivateKey.fromBase58(MINANFT_NFT_OWNER_SK);
    const ownerPublicKey = ownerPrivateKey.toPublicKey();
    const owner = Poseidon.hash(ownerPublicKey.toFields());

    const nft = new MinaNFT(`@minanft`);
    nft.updateText({
      key: `description`,
      text: "MinaNFT is a NFT standard for Mina Protocol, available for everyone to use at https://minanft.io and @MinaNFT_bot (telegram)",
    });
    nft.update({ key: `twitter`, value: `@minanft` });
    nft.update({ key: `github`, value: `https://github.com/dfstio` });
    nft.update({ key: `telegram`, value: `@MinaNFT_bot` });
    nft.update({ key: `discord`, value: `https://discord.gg/s4aM63bF` });
    nft.update({ key: `weblink`, value: `https://minanft.io` });

    await nft.updateImage({
      filename: "./logo/minanft.jpg",
      pinataJWT,
    });

    console.log(`json:`, JSON.stringify(nft.toJSON(), null, 2));
    const tx = await nft.mint({
      deployer,
      owner,
      pinataJWT,
      privateKey: PrivateKey.fromBase58(MINANFT_NFT_ADDRESS_SK),
    });
    expect(tx).toBeDefined();
    if (tx === undefined) return;
    Memory.info(`minted`);
    if (!useLocalBlockchain) expect(await MinaNFT.wait(tx)).toBe(true);
    expect(await nft.checkState()).toBe(true);
    expect(nft.address).toBeDefined();
    if (nft.address === undefined) return;
    expect(nft.address?.toJSON()).toBe(
      PublicKey.fromBase58(MINANFT_NFT_ADDRESS).toJSON()
    );
    console.log(`NFT minanft minted to the address:`, nft.address.toJSON());
  });
*/
  it(`should deploy Escrow contract`, async () => {
    expect(deployer).toBeDefined();
    if (deployer === undefined) return;
    const escrowPrivateKey = PrivateKey.fromBase58(ESCROW_SK);
    const escrow = new MinaNFTEscrow();
    const tx = await escrow.deploy(deployer, escrowPrivateKey);
    expect(tx).toBeDefined();
    if (tx === undefined) return;
    Memory.info(`escrow deployed`);
    if (!useLocalBlockchain) expect(await MinaNFT.wait(tx)).toBe(true);
    expect(escrow.address).toBeDefined();
    if (escrow.address === undefined) return;
    expect(escrow.address?.toJSON()).toBe(
      PublicKey.fromBase58(ESCROW).toJSON()
    );
    console.log(`Escrow deployed to the address:`, escrow.address.toJSON());
  });

  it(`should deploy twitter badge contract`, async () => {
    await deployBadge(
      "@badge_twitter",
      "MBTWTR",
      "twitter",
      BADGE_TWITTER_SK,
      BADGE_TWITTER,
      BADGE_TWITTER_ORACLE_SK
    );
  });
  it(`should deploy discord badge contract`, async () => {
    await deployBadge(
      "@badge_discord",
      "MBDCRD",
      "discord",
      BADGE_DISCORD_SK,
      BADGE_DISCORD,
      BADGE_DISCORD_ORACLE_SK
    );
  });
  it(`should deploy telegram badge contract`, async () => {
    await deployBadge(
      "@badge_telegram",
      "MBTGRM",
      "telegram",
      BADGE_TELEGRAM_SK,
      BADGE_TELEGRAM,
      BADGE_TELEGRAM_ORACLE_SK
    );
  });
  it(`should deploy github badge contract`, async () => {
    await deployBadge(
      "@badge_github",
      "MBGTHB",
      "github",
      BADGE_GITHUB_SK,
      BADGE_GITHUB,
      BADGE_GITHUB_ORACLE_SK
    );
  });
  it(`should deploy linkedin badge contract`, async () => {
    await deployBadge(
      "@badge_linkedin",
      "MBLKIN",
      "linkedin",
      BADGE_LINKEDIN_SK,
      BADGE_LINKEDIN,
      BADGE_LINKEDIN_ORACLE_SK
    );
  });
});

async function deployBadge(
  name: string,
  tokenSymbol: string,
  verifiedKey: string,
  badgeSK: string,
  badgePK: string,
  oracleSK: string
) {
  expect(deployer).toBeDefined();
  if (deployer === undefined) return;
  const badgePrivateKey = PrivateKey.fromBase58(badgeSK);
  const oraclePublicKey = PrivateKey.fromBase58(oracleSK).toPublicKey();
  const badge = new MinaNFTBadge({
    name,
    owner: `@minanft`,
    verifiedKey,
    verifiedKind: `string`,
    oracle: oraclePublicKey,
    tokenSymbol,
  });

  const tx = await badge.deploy(deployer, badgePrivateKey);
  expect(tx).toBeDefined();
  if (tx === undefined) return;
  Memory.info(`badge ${name} deployed`);
  if (!useLocalBlockchain) expect(await MinaNFT.wait(tx)).toBe(true);
  expect(badge.address).toBeDefined();
  if (badge.address === undefined) return;
  expect(badge.address?.toJSON()).toBe(PublicKey.fromBase58(badgePK).toJSON());
  console.log(`Badge ${name} deployed to the address:`, badge.address.toJSON());
}
