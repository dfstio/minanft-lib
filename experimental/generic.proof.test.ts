import { describe, expect, it } from "@jest/globals";
import {
  Bool,
  Field,
  FlexibleProvablePure,
  Struct,
  ZkProgram,
  verify,
} from "o1js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generateProof(t: FlexibleProvablePure<any>, name: string) {
  class ValidStruct extends Struct({
    myData: t,
  }) {}

  const ZkApp = ZkProgram({
    name: "zk-app-" + name,
    publicInput: ValidStruct,
    publicOutput: ValidStruct,

    methods: {
      prove: {
        privateInputs: [],
        method(value: ValidStruct) {
          value.myData.isValid().assertTrue();
          return value;
        },
      },
    },
  });

  return { ValidStruct, ZkApp };
}

describe("generic proof", () => {
  it("should create a proof", async () => {
    class MyStruct extends Struct({
      id: Field,
      someOtherField: Field,
    }) {
      isValid(): Bool {
        return this.id.lessThanOrEqual(Field.from(2));
      }
    }

    let { ValidStruct, ZkApp } = generateProof(MyStruct, "mystruct");
    const vk = (await ZkApp.compile()).verificationKey;
    const myStruct = new MyStruct({
      id: Field.from(1),
      someOtherField: Field.from(3),
    });
    const validStruct = new ValidStruct({ myData: myStruct });
    const proof = await ZkApp.prove(validStruct);
    const verified = await verify(proof, vk);
    expect(verified).toBeTruthy();
  });
});
