# Mina NFT nodejs library for TypeScript and Javascript

This library is designed for the easy integration for third-party developers and 
corporations with MinaNFT, allowing to start minting NFTs, adding public and private keys
and verifying data off-chain and on-chain within one hour with easy and intiutive API

## Installation

	yarn add minanft	

## Documentation
https://lib.minanft.io


## Example:
```typescript
    const nft = new MinaNFT('@test')
    nft.publicData.set("description", MinaNFT.stringToField("my nft @test"))
    nft.publicData.set("image", MinaNFT.stringToField("ipfs:Qm..."))
    const secret: Field = Field.random()
    const pwdHash: Field = Poseidon.hash([secret])

    await nft.mint(deployer, pwdHash)
```

## NFT on-chain and off-chain data
```mermaid
classDiagram
    class MinaNFT{
        name
        publicMapRoot
        publicFilesRoot
        privateMapRoot
        privateFilesRoot
        uri1
        uri2
        pwdHash
    }
    class uri{
        storage hash
    }
    class PrivateMerkleMap{
        key : value
    }
    class PublicMerkleMap{
        key : value
    }
    class PublicFiles{
      filename
      size
      mime-type
      sha2-256
      sha3-512
      MerkleTree root
    }
    class PrivateFiles{
      filename
      size
      mime-type
      sha2-256
      sha3-512
      powerToAddPublicData
      powerToAddPublicFiles
      powerToAddPrivateData
      powerToAddPrivateFiles
      powerToChangePassword
      powerToVerify
      MerkleTree root
    }
    class PublicFileMerkleTree{
      [file data]
    }
    class PrivateFileMerkleTree{
      [file data]
    }
    MinaNFT "uri1" --> uri : uri1
    MinaNFT "uri2" --> uri : uri2
    MinaNFT "publicMapRoot" --> PublicMerkleMap : publicMapRoot
    MinaNFT "privateMapRoot" --> PrivateMerkleMap : privateMapRoot
    uri --> IPFS
    uri --> Arweave
    PublicFiles "MerkleTree root" --> PublicFileMerkleTree : MerkleTree root
    MinaNFT "publicFilesRoot" --> PublicFiles
    PrivateFiles "MerkleTree root" --> PrivateFileMerkleTree : MerkleTree root
    MinaNFT "privateFilesRoot" --> PrivateFiles

```

## Usage:
```	typescript
	import { MinaNFT } from "minanft"; // const { MinaNFT } = require("minanft") for JavaScript
	import fs from "fs/promises";
	
	await MinaNFT.minaInit(); // init Mina network connection
	
	//Create NFT from image link
	const nft1 = MinaNFT.fromImageUrl("@mynftname1", "https://.../myimage.jpg");
	
	//Create NFT from text description of image using AI models ChatGPT and DALL-E
	const nft2 = MinaNFT.fromImageDescription("@mynftname2", "Description of the image");
	
	//Create NFT from voice description of image using AI models ChatGPT and DALL-E
	const nft3 = MinaNFT.fromVoiceUrl("@mynftname2", "https://.../voicemessage.ogg");
	
	// Add public visible and verifiable on-chain keys
	await nft1.addPublicKeys({country: "France", city: "Paris"});
	
	// Add private invisible, but verifiable on-chain keys
	await nft1.addPrivateKeys({author: "John Blockchain", date: "16-Aug-2023"});
	
	// Generate proof
	const proof = await nft1.getPrivateProof("date");
	
	// verify proof off-chain
	const isValid = await nft1.verifyPrivateProof(proof, "16-Aug-2023");
	
	// Get jwtToken at https://t.me/minanft_bot?start=auth
	// and then deploy NFT to MINA blockchain
	await nft1.deploy(jwtToken);
	
	await nft1.wait(); // Wait for deployment, can be up to 15 minutes
	
	console.log("See your new Mina NFT at minnaft.io\@mynftname1");
	
	// get all private data and keys
	const privateData = await nft1.getPrivateJson(); 
	
	// Write private keys to local disk
	await fs.writeFile("@nynftname1-private-v1.json", JSON.stringify(privateData));
	
	const tx = await nft1.getVerifyPrivateProofTransaction(proof, "16-Aug-2023");
	// then send tx to Mina Network to get verification on-chain
	
	// Restore NFT from JSON 
	const nft = MinaNFT.formPrivateJson(privateData);

```

## Website
https://minanft.io

## Library on NPM
https://www.npmjs.com/package/minanft

## Example
https://github.com/dfstio/minanft-lib-example

## Faucet 
https://faucet.minaprotocol.com






