# Mina NFT nodejs library for TypeScript and JavaScript

The MinaNFT project is an innovative Non-Fungible Token (NFT) platform that integrates the unique privacy features of the Mina blockchain with advanced AI technology. It's designed to redefine the NFT space by offering a range of functionalities that go beyond traditional NFT capabilities.

This library is designed for easy integration of third-party developers and corporations with MinaNFT, allowing them to start minting NFTs, adding public and private keys, and verifying data off-chain and on-chain within one hour with easy and intuitive API

## Features

### Contracts

- [MinaNFTContract](https://docs.minanft.io/api/class/minanftcontract/) for NFT
- [MinaNFTNameServiceContract](https://docs.minanft.io/api/class/minanftnameservicecontract/) for Name Service
- [MinaNFTMetadataUpdate](https://docs.minanft.io/api#MinaNFTMetadataUpdate) ZkProgram for metadata updates using Merkle Map proofs
- [RedactedMinaNFTMapCalculation](https://docs.minanft.io/api#RedactedMinaNFTMapCalculation) for redacted Merkle Maps proofs
- [RedactedMinaNFTTreeCalculation](https://docs.minanft.io/api#RedactedMinaNFTTreeCalculation20) for redacted Merkle Tree proofs
- [MinaNFTVerifier](https://docs.minanft.io/api/class/minanftverifier/) and MinaNFTTreeVerifier for verification of redacted map and tree proofs
- [MinaNFTVerifierBadge](https://docs.minanft.io/api/class/minanftverifierbadge/) for assigning badges to NFTs
- [Escrow](https://docs.minanft.io/api/class/escrow/) for NFT transfers through the escrow mechanism
- [NFTMintData](https://docs.minanft.io/api/class/nftmintdata/), [MintData](https://docs.minanft.io/api/class/mintdata/), [Metadata](https://docs.minanft.io/api/class/metadata/), MetadataMap, MetadataWitness, MetadataUpdate, MetadataTransition, Storage, Update, EscrowTransfer, EscrowApproval data structures to be used in contracts

### Data that can be put into NFT

- **Keys and Values:** strings up to 30 characters and Fields, written as Fields
- **Texts:** texts of any length, written as Field arrays
- **Files:** text, image, word, any other formats, including audio, video, PDF, binary. Written as two Merkle Trees: one with metadata and the other with file data: 30 bytes per Field for binary files, one character per Field for text files, and one pixel per Field for image files
- **Maps:** any collection of the types above grouped together.
- All the data can be marked as public or private

### Proving and verifying the data

- Proving and verifying key-value pairs
- Proving and verifying the texts, including redacted
- Proving and verifying the text and binary files as a whole file using SHA3-512
- Proving and verifying the redacted text and word files (some characters can be redacted by using masks)
- Proving and verifying the redacted PNG image files (some pixels can be redacted by using masks)

### API

- [NFT name reservation](https://docs.minanft.io/api/class/api/#reserveName)
- [NFT name lookup](https://docs.minanft.io/api/class/api/#lookupName)
- [NFT minting](https://docs.minanft.io/api/class/api/#mint)
- [Indexing NFT for frontend](https://docs.minanft.io/api/class/api/#indexName)
- [Creation of the post](https://docs.minanft.io/api/class/api/#post)
- [Creation and verification of the proofs, minting and sending transaction](https://docs.minanft.io/api/class/api/#proof)
- [Retrieving proof calculation results](https://docs.minanft.io/api/class/api/#waitForJobResult)
- [Getting billing reports](https://docs.minanft.io/api/class/api/#queryBilling)

### minanft TypeScript/JavaScript library

- TypeScript wrappers for contracts:
  - [MinaNFT](https://docs.minanft.io/api/class/MinaNFT) - main class for managing the NFT. Most interaction with NFT is executed with the help of this class.
  - [MinaNFTBadge](https://docs.minanft.io/api/class/MinaNFTBadge) - class for managing badges
  - [MinaNFTNameService](https://docs.minanft.io/api/class/MinaNFTNameService) - Name Service
  - [MinaNFTEscrow](https://docs.minanft.io/api/class/MinaNFTEscrow) - Escrow
  - [RedactedMinaNFT](https://docs.minanft.io/api/class/RedactedMinaNFT) - redacted Merkle Map proof calculations
  - [RedactedTree](https://docs.minanft.io/api/class/RedactedTree) - redacted Merkle Tree proof calculation
  - [MinaNFTTreeVerifierFunction](https://docs.minanft.io/api/function/MinaNFTTreeVerifierFunction) for generation Merkle Tree verification SmartContract and Merkle Tree proof calculation ZkProgram for the Merkle Trees of given height
- [api](https://docs.minanft.io/api/class/api) class for API calls
- [IPFS](https://docs.minanft.io/api/class/IPFS) for IPFS off-chain storage
- [ARWEAVE](https://docs.minanft.io/api/class/ARWEAVE) for Arweave off-chain storage
- [BackendPlugin](https://docs.minanft.io/api/class/BackendPlugin) for parallel calculations of the recursive proofs in the serverless backend

## Installation

```
yarn add minanft
```

## Documentation

https://docs.minanft.io

## Website

https://minanft.io

## Library on NPM

https://www.npmjs.com/package/minanft

## Example

https://github.com/dfstio/minanft-lib-example

## Faucet

https://faucet.minaprotocol.com
