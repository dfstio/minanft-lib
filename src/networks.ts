export { MinaNetworkURL, Berkeley, Lightnet, TestWorld2 };

interface MinaNetworkURL {
  mina: string[];
  archive: string[];
  chainId?: string;
  name?: string;
  accountManager?: string;
  explorerAccountUrl?: string;
  explorerTransactionUrl?: string;
}

const Berkeley: MinaNetworkURL = {
  mina: [
    "https://api.minascan.io/node/berkeley/v1/graphql",
    "https://proxy.berkeley.minaexplorer.com/graphql",
  ],
  archive: [
    "https://api.minascan.io/archive/berkeley/v1/graphql",
    "https://archive.berkeley.minaexplorer.com",
  ],
  explorerAccountUrl: "https://minascan.io/berkeley/account/",
  explorerTransactionUrl: "https://minascan.io/berkeley/tx/",
  chainId: "berkeley",
  name: "Berkeley",
};

const TestWorld2: MinaNetworkURL = {
  mina: ["https://api.minascan.io/node/testworld/v1/graphql"],
  archive: ["https://archive.testworld.minaexplorer.com"],
  explorerAccountUrl: "https://minascan.io/testworld/account/",
  explorerTransactionUrl: "https://minascan.io/testworld/tx/",
  chainId: "testworld2",
  name: "TestWorld2",
};

const Lightnet: MinaNetworkURL = {
  mina: ["http://localhost:8080/graphql"],
  archive: ["http://localhost:8282"],
  accountManager: "http://localhost:8181",
};
