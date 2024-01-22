export { MinaNetworkURL, Berkeley, Lightnet };

interface MinaNetworkURL {
  graphql: string;
  archive: string;
  chainId?: string;
  name?: string;
  accountManager?: string;
  explorerAccountUrl?: string;
  explorerTransactionUrl?: string;
}

const Berkeley : MinaNetworkURL = {
  graphql: "https://api.minascan.io/node/berkeley/v1/graphql",
  archive: "https://api.minascan.io/archive/berkeley/v1/graphql",
  explorerAccountUrl: "https://minascan.io/berkeley/account/",
  explorerTransactionUrl: "https://minascan.io/berkeley/tx/",
  chainId: 'berkeley', 
  name: 'Berkeley'
};

const Lightnet: MinaNetworkURL = {
  graphql: "http://localhost:8080/graphql",
  archive: "http://localhost:8282 ",
  accountManager: "http://localhost:8181",
}



