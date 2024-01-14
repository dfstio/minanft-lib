# Mina NFT nodejs library for TypeScript and JavaScript

The MinaNFT project is an innovative Non-Fungible Token (NFT) platform that integrates the unique privacy features of the Mina blockchain with advanced AI technology. It's designed to redefine the NFT space by offering a range of functionalities that go beyond traditional NFT capabilities.

This library is designed for easy integration of third-party developers and corporations with MinaNFT, allowing them to start minting NFTs, adding public and private keys, and verifying data off-chain and on-chain within one hour with easy and intuitive API

## Features

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
