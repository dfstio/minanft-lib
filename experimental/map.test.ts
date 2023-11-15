import { describe, expect, it } from "@jest/globals";
import { Encoding, MerkleMap, Field, PublicKey } from "o1js";

function add(
  map1: MerkleMap,
  map2: MerkleMap,
  key: Field,
  value1: Field,
  value2: Field
) {
  map1.set(key, value1);
  map2.set(key, value2);
}
describe("Merkle Map", () => {
  it("should generate witnesses and verify roots", async () => {
    const map1 = new MerkleMap();
    const root: Field = map1.getRoot();
    const key: PublicKey = PublicKey.fromFields([root, root]);
    console.log("key", key.toBase58());
    const map2 = new MerkleMap();
    add(map1, map2, Field(1), Field(2), Field(7));
    add(map1, map2, Field(2), Field(4), Field(8));
    add(map1, map2, Field(3), Field(5), Field(9));
    const witness1 = map1.getWitness(Field(3));
    const witness2 = map2.getWitness(Field(3));
    const root1 = map1.getRoot();
    const root2 = map2.getRoot();
    const [root1calc, key1calc] = witness1.computeRootAndKey(Field(5));
    const [root2calc, key2calc] = witness2.computeRootAndKey(Field(9));
    expect(root1calc.toJSON()).toEqual(root1.toJSON());
    expect(root2calc.toJSON()).toEqual(root2.toJSON());
    expect(key1calc.toJSON()).toEqual(Field(3).toJSON());
    expect(key2calc.toJSON()).toEqual(Field(3).toJSON());
  });

  it("should convert IPFS and Arweave hashes to Fields", async () => {
    const ipfs_v0 = "i:QmbWqxBEKC3P8tqsKc98xmWNzrzDtRLMiMPL8wBuTGsMnR";
    const ipfs_v1 =
      "i:bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
    expect(Encoding.stringToFields(ipfs_v0).length).toEqual(2);
    expect(Encoding.stringToFields(ipfs_v1).length).toEqual(2);
    const arweave = "a:4OIZ1pAi3KZvEnZZ1af15BIuL3Y_ql32WWIrTpQc69Y";
    expect(Encoding.stringToFields(arweave).length).toEqual(2);
  });
});
