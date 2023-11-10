export { blockchain, initBlockchain };

import { Mina } from "o1js";
import { MINAURL, ARCHIVEURL, TESTWORLD2 } from "../src/config.json";

type blockchain = "local" | "berkeley" | "testworld2" | "mainnet";

function initBlockchain(instance: blockchain): void {
  if (instance === "local") {
    const Local = Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);
  } else if (instance === "berkeley" || instance === "testworld2") {
    const network = Mina.Network(
      instance === "berkeley"
        ? {
            mina: MINAURL,
            archive: ARCHIVEURL,
          }
        : {
            mina: TESTWORLD2,
          }
    );
    Mina.setActiveInstance(network);
  } else {
    throw new Error("Mainnet is not supported yet.");
  }
}
