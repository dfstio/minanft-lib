# Mina NFT nodejs library for TypeScript and JavaScript

This library is designed for easy integration of third-party developers and corporations with MinaNFT, allowing them to start minting NFTs, adding public and private keys, and verifying data off-chain and on-chain within one hour with easy and intuitive API

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

## Example:

```typescript
const nft = new MinaNFT({ name: `@test` });
nft.updateText({
  key: `description`,
  text: "This is my long description of the NFT. Can be of any length, supports markdown.",
});
nft.update({ key: `twitter`, value: `@builder` });
nft.update({ key: `secret`, value: `mysecretvalue`, isPrivate: true });
await nft.updateImage({
  filename: "./images/navigator.jpg",
  pinataJWT,
});
const map = new MapData();
map.update({ key: `level2-1`, value: `value21` });
map.update({ key: `level2-2`, value: `value22` });
map.updateText({
  key: `level2-3`,
  text: `This is text on level 2. Can be very long`,
});
await map.updateFile({
  key: "woman",
  filename: "./images/woman.png",
  pinataJWT,
});
const mapLevel3 = new MapData();
mapLevel3.update({ key: `level3-1`, value: `value31` });
mapLevel3.update({ key: `level3-2`, value: `value32`, isPrivate: true });
mapLevel3.update({ key: `level3-3`, value: `value33` });
map.updateMap({ key: `level2-4`, map: mapLevel3 });
nft.updateMap({ key: `level 2 and 3 data`, map });

console.log(`metadata json:`, JSON.stringify(nft.toJSON(), null, 2));
const tx = await nft.mint({
  deployer,
  owner,
  pinataJWT,
  nameService,
});
```

console.log() output:

```
{
  "name": "@test",
  "description": "This is my long description of the NFT. Can be of any length, supports markdown.",
  "image": "https://ipfs.io/ipfs/QmaRZUgm2GYCCjsDCa5eJk4rjRogTgY6dCyXRQmnhvFmjj",
  "external_url": "https://minanft.io/@test",
  "version": "1",
  "properties": {
    "description": {
      "data": "18517207261845548419976623877380749961354033201106730554029419367822129049904",
      "kind": "text",
      "linkedObject": {
        "type": "text",
        "MerkleTreeHeight": 8,
        "size": 80,
        "text": "This is my long description of the NFT. Can be of any length, supports markdown."
      }
    },
    "twitter": { "data": "@builder", "kind": "string" },
    "image": {
      "data": "10933230901147616890011856723104406636132207767661104022200152886713008012214",
      "kind": "image",
      "linkedObject": {
        "type": "file",
        "fileMerkleTreeRoot": "12270219107974990626194443794620557463255219768178943904127152237423102258649",
        "MerkleTreeHeight": 15,
        "size": 447504,
        "mimeType": "image/jpeg",
        "SHA3_512": "Xi6MogV1W1lxB+kS/lx4QlZoNIbMLjK/x0Re8k5Ldmd/1oLdFysw45dULcNVpWSKaJ7HGiJb5gV8cC63mHrCCw==",
        "filename": "navigator.jpg",
        "storage": "i:QmaRZUgm2GYCCjsDCa5eJk4rjRogTgY6dCyXRQmnhvFmjj"
      }
    },
    "level 2 and 3 data": {
      "data": "11885314413346415507686033256426043319433077311130413960112944947713555004108",
      "kind": "map",
      "linkedObject": {
        "type": "map",
        "properties": {
          "level2-1": { "data": "value21", "kind": "string" },
          "level2-2": { "data": "value22", "kind": "string" },
          "level2-3": {
            "data": "17918742563826681862408641965129071963958922660597457205933767099995396120858",
            "kind": "text",
            "linkedObject": {
              "type": "text",
              "MerkleTreeHeight": 7,
              "size": 41,
              "text": "This is text on level 2. Can be very long"
            }
          },
          "woman": {
            "data": "19568479839056312372186989986426075833813097455848029420463865331716879702558",
            "kind": "image",
            "linkedObject": {
              "type": "file",
              "fileMerkleTreeRoot": "4911692193899654945543701504504186590310741443090166466526044610874096406940",
              "MerkleTreeHeight": 15,
              "size": 265511,
              "mimeType": "image/png",
              "SHA3_512": "LvUjVX9PlqxWsfHgIf3lvpVFy7o5hAcHVAFueQt+RP4hyr6h2f6XyeinP5jwgKhcogOhEyxHchdBdnvbdeDL9A==",
              "filename": "woman.png",
              "storage": "i:Qme3jDkLmEKHDkkMpp1H15zzWhQMmqBizVBcRj2UmWe5Lj"
            }
          },
          "level2-4": {
            "data": "8285588111605202531040894738541072590635328681101967631265604553962773840451",
            "kind": "map",
            "linkedObject": {
              "type": "map",
              "properties": {
                "level3-1": { "data": "value31", "kind": "string" },
                "level3-3": { "data": "value33", "kind": "string" }
              }
            }
          }
        }
      }
    }
  }
}

```
