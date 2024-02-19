import { describe, expect, it } from "@jest/globals";
import { Field } from "o1js";
import { File } from "../src/storage/file";

const images = ["./images/image.jpg", "./images/sea.png"];

describe(`Tree root calculations`, () => {
  for (const image of images) {
    let fast:
      | { leavesNumber: number; root: Field; height: number }
      | undefined = undefined;
    let slow:
      | { leavesNumber: number; root: Field; height: number }
      | undefined = undefined;

    it(`should calculate root fast`, async () => {
      const file = new File(image);
      console.time(`${image} merkle tree root calculated fast`);
      fast = await file.treeData(true, true);
      console.timeEnd(`${image} merkle tree root calculated fast`);
    });
    it(`should calculate root slow`, async () => {
      const file = new File(image);
      console.time(`${image} merkle tree root calculated slow`);
      slow = await file.treeData(true, false);
      console.timeEnd(`${image} merkle tree root calculated slow`);
    });
    it(`should compare values`, async () => {
      expect(fast).toBeDefined();
      expect(slow).toBeDefined();
      if (fast === undefined || slow === undefined) return;
      expect(fast.leavesNumber).toBe(slow.leavesNumber);
      expect(fast.height).toBe(slow.height);
      expect(fast.root.toJSON()).toBe(slow.root.toJSON());
    });
  }
});
