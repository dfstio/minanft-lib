const config = {
  MINAFEE: 100_000_000,
  MINANFT_API_AUTH:
    "AkRjS8yioA7i1CwvB3nOvcyLYh6sNMi4em7C0ybmYy67lhDC2KxEQtm1z45llEAR",
  MINANFT_API: "https://n1zjzclr99.execute-api.eu-west-1.amazonaws.com/dev/api",
  CONTRACT_DEPLOYER: "B62qiTrtDyWmDFMQvUDRUdWVsVwNFhUV4rkPVgeANi4adKhrUwfdNFT",
  NAMES_ORACLE: "B62qids6rU9iqjvBV4DHxW8z67mgHFws1rPmFoqpcyRq2arYxUw6sZu",
  MINANFT_NAME_SERVICE:
    "B62qrryunX2LzaZ1sGtqfJqzSdNdN7pVSZw8YtnxQNxrrF9Vt56bNFT",
  MINANFT_NAME_SERVICE_V2:
    //"B62qnzkHunByjReoEwMKCJ9HQxZP2MSYcUe8Lfesy4SpufxWp3viNFT",
    "B62qs2NthDuxAT94tTFg6MtuaP1gaBxTZyNv9D3uQiQciy1VsaimNFT",
  MINANFT_NAME_SERVICE_OLD:
    "B62qpiD9ZWPi1JCx7hd4XcRujM1qc5jCADhhJVzTm3zZBWBpyRr3NFT",
  MINANFT_NFT_ADDRESS:
    "B62qjfEWNWx4WzD5WvMomzv37FiPhuph4pTMtKDvkSQbNt8HN1BDGtQ",
  BADGE_TWITTER: "B62qmYSotSkUHY8XwsinGpW3gqTpsyoZcQoLK5d3qTAJ9oy1dRVD11b",
  BADGE_DISCORD: "B62qnVYz1TiirtTuqj5oM3Nke8jvdMV8MKEKQvGDc4hUy86n2txx9MG",
  BADGE_TELEGRAM: "B62qk2JqK8ttXdyhGToSU82Bt3xEZZs5AszxF6Xoa8Gy4Bq41PVWZXH",
  BADGE_GITHUB: "B62qjVBj9nn5io9zeooweWzPqKGLzaXZptxWuFJcKLLkJUaDGXxn7E1",
  BADGE_LINKEDIN: "B62qqsvkxnzr6nyDGQQzKUktm6km3PTND9Lz9yaLcJLSBd9Fm3KZMUJ",
  VERIFIER: "B62qqzwDxiH172SXE4SUVYsNV2FteL2UeYFsjRqF4Qf42KnE1q1VNFT",
  ESCROW: "B62qoc7Juw7Q41y2QGwhadKck3qWB9brzCEegCBY8SPZWzUNtZXyQGd",
  BADGE_TWITTER_ORACLE:
    "B62qkvDzFG2VLkDDnkJvpG3Zp2QfRooiZDhnDcJEr4HTrnS8z5xc7qn",
  BADGE_DISCORD_ORACLE:
    "B62qnBQWrZPYBUq856nSMN5bPbUnEKVeXhbeb9o9dWKkHhCmDfFz8pG",
  BADGE_TELEGRAM_ORACLE:
    "B62qqSFncUiht898ukZr7vxVPCMfztk2jnMRxJzddJr6sdRJZApcotT",
  BADGE_GITHUB_ORACLE:
    "B62qmFn6DnRzNmhiHRYSCL5Aaabe7nQVSC78NdzfRuw1p77mjBNVwrb",
  BADGE_LINKEDIN_ORACLE:
    "B62qkHnwZGjiLnJwUrVJVrBp3bxqYe8cW4nrLuAB5p9QJwS16Q4Msn1",
  VERIFICATION_KEY_V2_JSON: {
    devnet: {
      hash: "6066211904755873509029517833979311169218619595163132349151228328092282280766",
      data: "AACbQW7Ui5kXAmLYXMIi1esmfeF0njjbkI32bMDTbeRdEg2iROS1dYZSBKrogFDr6nUV8VJp14ro1x9bvC2WJoQo0fsmpe6A3Y9GkpTjPxR6QOMvKNW7fqcfdlPZN7wNuThz2PxhNMksMmCULbfP04etnNvDgMqdBImitMj3iCKKEZbcbK4UX3zIorFecGFWLOyGE3KBNYRXGqAFsgfqIjMunGyp22JTUd9VvICJEluSj83WWNUIBKntC/PgHXgHnQ+zk03BQFYTjoMjSOimSWFuCyzAD6x09NYivvKTIn65Kclm4GGPfdDw2irfYkMOMjTu82rhsYjrChdrRy0qeCAocgnJ0p/7414EqJYWNu8aAdUHy5tYA1WZieFvYOPmKBEVrZcSfq5IjB6f+ztMmm1/RPlfYkRFqQF/EN72qDR6DKfyLry+Tjqt6yRQOtDkdVEXajs/hy5gyPo80E37XOsVKXBmUVZzu8efVbt8+g6/2GmNZOPAhn7kyGAO0EUvZQ0cyktXbXF2T3uXTjg/t6xPo+UUOMgYN6VvqEy0UmKOCOiiWbRajXBwOGlTan3bpXkzPjoqCaNExf/X92LL7iMdAGw3MtPVadrrvvbUNPyh56LGEaSHzK4KuQ4u52UdLfgjpKQsH0ez3gNsAfDbvkJ9pVTO98Z7TXyLprAx0WV11R4xlU2dq9f6S92haFnBmtPKC26Wsh6hjsIy7LMsWtV8Da2TQyINlDgxbehG8+3QakCALKTCtT1S5NY7w2FmDpkGMRgHQgUcxKsYJmWqyw+hDpqxp843bWongvPBPtSNUSFMf7+GKZxLD48EnFqDfox5xXzO5hn9sEwf9YbKuDpLPLx7Hz8GT9E9aONYAty/Q/QkPRFaABnN498+npdnGzMYZsMERxzGwDQiW40A3KGvSR7KS7gTfho4uqanBib2biMTUSEl+dpt6/G5sz6idWx6B2skStm73nrE8hlq+HuUJOen9iiggpsL2r/h7dyQKtkXDn84pokKOglh8nV70yoLkMAV0i9q8P1RVTk74T8K7+u5Iu4T3Ee5aH2C12g5FxLYOE4vODhRI3sK3d/ct15CZT7EkFDh+N7p29ewr1/VAJLAr4/Zs4kRR7SQ3F9gulaun+AwLxLLMERzZ8B1ij4ZDT2+8svVyIqQleBrn0g1JWJi1xp7uJxVYlAd09Gv2zjOvYya8BmdohC/um4yf7p9ioIIR40IY8y0mRszHp0IAgAyP7nhvUdlWydsV+GMJ7J8x29PQANCsYgQzmMtCGcSt/E9P+kZSf9MZdWXglTzdX39N0642VFvwF1m8i+oFy+L2YE+NYea4/KBG55M3qPeWYJLyzuhn2ZFsyXI+2adCDDlAOcPB+vpZwF/BtweoEl75EEsJm3F0CfCNHKwR+YdFOkv3iVptgYn4cnRbvF+mDyL49RzIt1TVryiQCYjdS3/5qMDJdQtV5ZnQm2ylyih6RiiA0Hc7bwCfrcsdEvRMWIsyMG3aRJZuSZ1Ma+sysunPMf2nuNmHk6sStcyGFcaQ/SXBc6t4LPyc5xVFlE5/T7v/+FKrpzphjZ/Bq28VA8s12Vf3ASXjSAeA9le3AYzmhL41pa2VKKRGtqrCUAqPzu2qbD5kqN9MLS+ULZ8cC3YUiHwCfUaaw/uZpELE2srFPLWZuBsMowGEkF0pfsrh/a0L4catQfyleB60/YDgS3G3JVGO9FSwfeM1/Bxzgxst9asnUyyTOsyZZ21mFY2Pax0ZnlOHF694xpmjYk27foF3nFQrIRFdMMr+cNke4kA9Mkd+Wx3C5awyZ3mTxFKdz81iIScWLRzJzkQ22W32CoUY1LTvLN7XC1PMUtelYR6+/cqsxtrttoUixJ23mtBKgAkX6vA4IH657wlwEaCptiicKbnwotSuxVetTYpmm0QMnm8+vfi336LScc5ep64raOaWZr3Z9BCzlRIAz//7sUCzbEpxiXfvuOZk96gj5VDPaF1B9tB7ouXdf70h7NPzRYk0zsOPjLGibt23+BP9q+oLMXwXmkcmlQ6TWIao1+LJxd6cIktO7bazEdwAAUblrz13iJ6TBYa84pColzaNLUk2H/ngD1Jd2vBz7P2B9HQQ/YwiI5mFp46UodD04LQ6S+4/tf07qtKGplmLzjmoScM+gApWY7ofltR3oEc8I4XFaqRIu/29G8nRacyeeKatJQDEvYLrru1AsuOTft6zBcTrx4KFhrq2o3JFkcVYxKIuGgkEgc99sD7K0cYcJ2VDg5C/Se4KWL0xKdvvL1jag0Ju/aCNSrkO7jLHV28yVgSHVvSyFY+idIf7P8lfmBTMWQLMYu0QM4SEvgzIJCACCI2LllY9dyJuNbPytjzk078UQFB9OnmixCK7CcGmU09VBE=",
      nameHash:
        "6917570092496487860169033479826113111386127324856820912221963430930481268223",
    },
    mainnet: {
      hash: "19598809197575993038539243112808085696121087889056375482257803925816746642628",
      data: "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",
      nameHash:
        "24746186622553277662878141131507829208482831484370089159005999912111636956018",
    },
  },
};

export default config;
