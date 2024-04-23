import { describe, expect, it } from "@jest/globals";
import { Client, ClientResultObject } from "@doot-oracles/client";
import {
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  Signature,
  SmartContract,
  state,
  State,
  method,
  AccountUpdate,
} from "o1js";
import { initBlockchain } from "../utils/testhelpers";
import { DOOT_API_KEY } from "../env.json";

export class Swap extends SmartContract {
  @state(Field) minaPrice = State<Field>();
  @state(Field) ethereumPrice = State<Field>();

  @state(Field) minaToEthExchange = State<Field>();
  @state(Field) ethToMinaExchange = State<Field>();

  init() {
    super.init();
  }

  @method async updatePrices(
    priceE: Field,
    signatureE: Signature,
    priceM: Field,
    signatureM: Signature,
    oracle: PublicKey
  ) {
    this.ethereumPrice.getAndRequireEquals();
    this.minaPrice.getAndRequireEquals();

    // Evaluate whether the signature is valid for the provided data
    const validM = signatureM.verify(oracle, [priceM]);
    const validE = signatureE.verify(oracle, [priceE]);
    validE.assertTrue();
    validM.assertTrue();

    this.minaPrice.set(priceM);
    this.ethereumPrice.set(priceE);
  }

  @method async setExchangeRates(minaToEth: Field, ethToMina: Field) {
    this.ethToMinaExchange.getAndRequireEquals();
    this.minaToEthExchange.getAndRequireEquals();

    this.ethToMinaExchange.set(ethToMina);
    this.minaToEthExchange.set(minaToEth);
  }
}

describe("MINA price", () => {
  it(`should get and verify MINA price`, async () => {
    console.time("verified price");
    //await initBlockchain("local");

    const client = new Client(DOOT_API_KEY);

    const mina: ClientResultObject = await client.Price("mina");
    console.log({ mina });
    const ethereum: ClientResultObject = await client.Price("ethereum");
    console.log({ ethereum });

    const priceM = Field.from(mina.price);
    const signatureM = Signature.fromBase58(mina.signature);
    const priceE = Field.from(ethereum.price);
    const signatureE = Signature.fromBase58(ethereum.signature);

    const oracle = PublicKey.fromBase58(mina.oracle);

    const proofsEnabled = false;

    const Local = await Mina.LocalBlockchain({ proofsEnabled: proofsEnabled });
    Mina.setActiveInstance(Local);

    const deployerPK = Local.testAccounts[0].privateKey;
    const deployer = deployerPK.toPublicKey();
    const zkappPK = PrivateKey.random();
    const zkapp = zkappPK.toPublicKey();

    if (proofsEnabled) await Swap.compile();
    const swap = new Swap(zkapp);

    console.log("\nDeploying Swap...");

    let txn = await Mina.transaction(deployer, async () => {
      AccountUpdate.fundNewAccount(deployer);
      await swap.deploy({});
    });

    await txn.prove();
    await txn.sign([zkappPK, deployerPK]).send();

    console.log("\nInitial Prices On-Chain =========================");
    console.log("MINA / USD:", swap.minaPrice.get().toBigInt());
    console.log("ETH / USD :", swap.ethereumPrice.get().toBigInt());

    txn = await Mina.transaction(deployer, async () => {
      await swap.updatePrices(priceE, signatureE, priceM, signatureM, oracle);
    });
    await txn.prove();
    await txn.sign([deployerPK]).send();

    console.log("\nUpdated Prices On-Chain =========================");
    console.log("MINA / USD:", swap.minaPrice.get().toBigInt());
    console.log("ETH / USD :", swap.ethereumPrice.get().toBigInt());
    console.log(
      "MINA / USD:",
      Number(swap.minaPrice.get().toBigInt()) / 10000000000
    );

    console.log("\nExchange Rates On-Chain =========================");
    const onChainMinaPrice = swap.minaPrice.get().toString();
    const onChainEthPrice = swap.ethereumPrice.get().toString();

    const minaToEth = Field.from(
      (BigInt(onChainMinaPrice) * 10000000000n) / BigInt(onChainEthPrice)
    );

    const ethToMina = Field.from(
      (BigInt(onChainEthPrice) * 10000000000n) / BigInt(onChainMinaPrice)
    );

    txn = await Mina.transaction(deployer, async () => {
      await swap.setExchangeRates(minaToEth, ethToMina);
    });
    await txn.prove();
    await txn.sign([deployerPK]).send();

    console.log("Fields ->");
    console.log("MINA / ETH:", swap.minaToEthExchange.get().toBigInt());
    console.log("ETH / MINA :", swap.ethToMinaExchange.get().toBigInt());
    console.log("Actual Exchange Rates(/10**10) ->");
    console.log(
      "MINA / ETH :",
      Number(swap.minaToEthExchange.get().toBigInt()) / 10000000000
    );
    console.log(
      "ETH / MINA :",
      Number(swap.ethToMinaExchange.get().toBigInt()) / 10000000000
    );
    console.log("\n");

    console.timeEnd("verified price");
  });
});
