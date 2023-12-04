import { describe, expect, it } from "@jest/globals";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

describe(`Dynamic import`, () => {
  it(`should import module`, async () => {
    /*
    const rl = readline.createInterface({ input, output });
    const answer = await rl.question(
      "Enter the name of the file with contracts:"
    );
    const file = `./` + answer;
    console.log(`Thank you for your answer: ${file}`);
    rl.close();
    */
    const contracts = await import("./contracts");
    expect(contracts).toBeDefined();
    const tf = "TreeFunction";
    const args = 5;
    const { TreeCalculation, TreeVerifier } = contracts[tf](args);
    await TreeCalculation.compile();
    await TreeVerifier.compile();
  });
});
