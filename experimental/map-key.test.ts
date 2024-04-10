import { describe, expect, it } from "@jest/globals";
import { Field, MerkleMap } from "o1js";

describe("Map key", () => {
  it(`should get witness`, async () => {
    const map = new MerkleMap();
    const key = Field(2);
    const value = map.get(key);
    console.log("value", value.toJSON());
    const witness = map.getWitness(key);
    const [, calculatedKey] = witness.computeRootAndKey(Field(0));
    console.log("calculatedKey", calculatedKey.toJSON());
    expect(calculatedKey.toJSON()).toEqual(key.toJSON());
  });
});
