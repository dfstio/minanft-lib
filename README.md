# Mina NFT nodejs library for TypeScript and Javascript

This library is designed for the easy integration for third-party developers and 
corporations with MinaNFT, allowing to start minting NFTs, adding public and private keys
and verifying data off-chain and on-chain within one hour with easy and intiutive API

## Installation

	yarn add minanft	
	
## Example:
	yarn test
	/**
	publicJson {
		publicMapRoot: '22731122946631793544306773678309960639073656601863129978322145324846701682624',
		publicData: {
			name: '@test',
			description: 'my nft @test',
			image: 'https/ipfs.io/ipfs/Qm...'
		}
	}
	privateJson {
		publicMapRoot: '22731122946631793544306773678309960639073656601863129978322145324846701682624',
		privateMapRoot: '22731122946631793544306773678309960639073656601863129978322145324846701682624',
		secret: '27316507744649576315264793589997090976505003005329138038060744248453624828573',
		salt: '28415388566484028622541902066833196068283745836710945290933054341632001313105',
		publicData: {
			name: '@test',
			description: 'my nft @test',
			image: 'https/ipfs.io/ipfs/Qm...'
		},
		privateData: { name: 'cohort2' }
	}
	**/
	
## Usage:
```	
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






