import { describe, expect, it } from "@jest/globals";
import { Encoding, Field } from "o1js";

const str = "Hello, World!";
let fields: Field[] = [];

describe("Convert string to Fields and back", () => {
  it("should convert string to Fields", async () => {
    fields = Encoding.stringToFields(str);
    expect(fields.length).toBe(1);
  });
  it("should convert Fields to string", async () => {
    expect(fields.length).toBe(1);
    const restoredString: string = Encoding.stringFromFields(fields);
    expect(restoredString).toBe(str);
  });
});
