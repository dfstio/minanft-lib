import { describe, expect, it } from "@jest/globals";
import { Mina, fetchEvents } from "o1js";

describe(`Events`, () => {  
  it(`should get events`, async () => {
    const network = Mina.Network({
      mina: "https://proxy.berkeley.minaexplorer.com/graphql",
      archive: "https://archive.berkeley.minaexplorer.com"
    });
    Mina.setActiveInstance(network);
    const events = await fetchEvents({
      publicKey: "B62qpiD9ZWPi1JCx7hd4XcRujM1qc5jCADhhJVzTm3zZBWBpyRr3NFT"
    });
    expect(events).toBeDefined();
    if (events === undefined) return;
    console.log("Events", events);
  });

  it(`should get events using minascan`, async () => {
    const network = Mina.Network({
      mina: "https://api.minascan.io/node/berkeley/v1/graphql",
      archive: "https://api.minascan.io/archive/berkeley/v1/graphql"
    });
    Mina.setActiveInstance(network);
    const events = await fetchEvents({
      publicKey: "B62qpiD9ZWPi1JCx7hd4XcRujM1qc5jCADhhJVzTm3zZBWBpyRr3NFT"
    });
    expect(events).toBeDefined();
    if (events === undefined) return;
    console.log("Events", events);
  });
});

