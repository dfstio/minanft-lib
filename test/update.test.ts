import { describe, expect, it } from '@jest/globals';
import { Mina, Field, Poseidon, PrivateKey } from 'o1js';
import { MinaNFT } from "../src/minanft"

jest.setTimeout(1000 * 60 * 60); // 1 hour

let deployer: PrivateKey | undefined = undefined

beforeAll(async () => {
  const Local = Mina.LocalBlockchain({ proofsEnabled: true })
  Mina.setActiveInstance(Local)
  const { privateKey } = Local.testAccounts[0]
  deployer = privateKey
  await MinaNFT.compile()
});

describe('MinaNFT contract', () => {
  it('should mint and update MinaNFT NFT', async () => {
    expect(deployer).not.toBeUndefined()
    if (deployer === undefined) return

    const nft = new MinaNFT('@test') //, PublicKey.fromBase58(NFT_ADDRESS))
    nft.publicData.set("description", MinaNFT.stringToField("my nft @test"))
    nft.publicData.set("image", MinaNFT.stringToField("ipfs:Qm..."))
    const secret: Field = Field.random()
    const pwdHash: Field = Poseidon.hash([secret])

    await nft.mint(deployer, pwdHash)

    // update public data
    nft.updatePublicData("twitter", MinaNFT.stringToField("@mytwittername"))
    nft.updatePublicData("discord", MinaNFT.stringToField("@mydiscordname"))
    nft.updatePublicData("linkedin", MinaNFT.stringToField("@mylinkedinname"))

    await nft.commit(deployer, secret)  // commit the update to blockchain
  })
})

