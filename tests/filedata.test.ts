import { describe, expect, it } from "@jest/globals";
import { Memory } from "../src/mina";
import { FileData } from "../src/storage/file";

const image = {
  data: "23717767265007149059953250070045924828298761381104277030140439758556960823838",
  kind: "image",
  linkedObject: {
    type: "file",
    fileMerkleTreeRoot:
      "9168436551035591380917456054103972041580227633358631576197455136991655404720",
    MerkleTreeHeight: 15,
    size: 287846,
    mimeType: "image/jpeg",
    SHA3_512:
      "qRm+FYlhRb1DHngZ0rIQHXAfMS1yTi6exdbfzrBJ/Dl1WuzCuif1v4UDsH4zY+tBFEVctBnHo2Ojv+0LBuydBw==",
    filename: "image.jpg",
    storage: "i:QmYAwGfKf4MetTbMTyRXiE9epsxtih35ApDPyu6MVqTey9",
  },
};

let fileData: FileData | undefined = undefined;

describe("Calculate FileData proof", () => {
  it("should import FileData", async () => {
    Memory.info("start");
    fileData = FileData.fromJSON(image);
  });

  it("should calculate proof", async () => {
    expect(fileData).toBeDefined();
    if (fileData === undefined) return;
    console.time("calculated proof");
    await fileData.proof();
    console.timeEnd("calculated proof");
  });
});
