import { describe, expect, it } from '@jest/globals';
import { Mina, Field, Poseidon, PrivateKey } from 'o1js';
import { MinaNFT } from "../src/minanft"
import { DEPLOYER } from "../env.json"

jest.setTimeout(1000 * 60 * 60); // 1 hour

let deployer: PrivateKey | undefined = undefined

beforeAll(async () => {
  const Local = Mina.LocalBlockchain({ proofsEnabled: true });
  Mina.setActiveInstance(Local);
  const { privateKey } = Local.testAccounts[0];
  deployer = privateKey
  await MinaNFT.compile()
});

describe('MinaNFT contract', () => {
  it('should mint MinaNFT NFT', async () => {
    expect(deployer).not.toBeUndefined()
    if (deployer === undefined) return

    const nft = new MinaNFT('@test') //, PublicKey.fromBase58(NFT_ADDRESS))
    nft.publicData.set("description", MinaNFT.stringToField("my nft @test"))
    nft.publicData.set("image", MinaNFT.stringToField("ipfs:Qm..."))
    const secret: Field = Field.random()
    const pwdHash: Field = Poseidon.hash([secret])

    await nft.mint(deployer, pwdHash)
  })

  it('should update MinaNFT public Map', async () => {
    const nft = new MinaNFT('@test') //, PublicKey.fromBase58(NFT_ADDRESS))
    nft.publicData.set("description", MinaNFT.stringToField("my nft @test"))
    nft.publicData.set("image", MinaNFT.stringToField("ipfs:Qm111..."))
    const data = await nft.getPublicMapRootAndMap()
    expect(data).not.toBeUndefined()
    if (data === undefined) return
    const { root } = data
    expect(root.toJSON()).not.toBe("5895890148231822126701486938886360559288862152317716797057674584801775694501")
  })
})

