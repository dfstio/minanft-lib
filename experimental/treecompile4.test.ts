import { describe, expect, it } from "@jest/globals";
import { Field, MerkleWitness, ZkProgram, method, SmartContract } from "o1js";

const height = 5;

describe(`Merkle Tree contract`, () => {
  it(`should compile contracts`, async () => {
    const TreeFunction = await import("./myzkprogram");
    const { TreeCalculation, TreeVerifier } = TreeFunction(height);
    //await TreeCalculation.compile();
    //await TreeVerifier.compile();
  });
});
