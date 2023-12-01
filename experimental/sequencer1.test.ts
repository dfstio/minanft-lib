import { describe, expect, it } from "@jest/globals";

const size: number = 3;

interface Step {
  jobId: string;
  id: string;
  index: number;
  merge: boolean;
  final: boolean;
  peer: string;
  transaction: string;
  input: string[];
  status: string;
  result?: string;
}

abstract class Sequencer {
  jobId: string;
  transactions: string[];
  length: number;
  levels: number[];
  steps: Step[];

  constructor(jobId: string, transactions: string[]) {
    this.jobId = jobId;
    this.transactions = transactions;
    this.length = transactions.length;
    this.levels = [];
    this.levels.push(this.length);
    this.steps = [];
    this.prepareSteps();
  }

  private prepareSteps() {
    let length = this.length;
    let level: number = 0;
    let index: number = 0;
    let remainder: Step | undefined = undefined;
    while (length > 0 && index < 10) {
      for (let i = 0; i < length; i += 2) {
        const stepLeft: Step = {
          jobId: this.jobId,
          id: `${level}.${i}`,
          index: index++,
          status: "created",
          merge: level === 0 ? false : true,
          final: length === 1 ? true : false,
          peer:
            length === 1
              ? ""
              : length - i > 1
              ? `${level}.${i + 1}`
              : `${level + 1}.${i / 2 - 1}`,
          transaction: level === 0 ? this.transactions[i] : "",
          input:
            level === 0
              ? []
              : [`${level - 1}.${i * 2}`, `${level - 1}.${i * 2 + 1}`],
        };
        console.log("stepLeft", stepLeft);
        this.steps.push(stepLeft);
        if (length - i > 1) {
          const stepRight: Step = {
            jobId: this.jobId,
            id: `${level}.${i + 1}`,
            index: index++,
            status: "created",
            merge: level === 0 ? false : true,
            final: false,
            peer: `${level}.${i}`,
            transaction: level === 0 ? this.transactions[i + 1] : "",
            input:
              level === 0
                ? []
                : [
                    `${level - 1}.${(i + 1) * 2}`,
                    `${level - 1}.${(i + 1) * 2 + 1}`,
                  ],
          };
          this.steps.push(stepRight);
          console.log("stepRight", stepRight);
        } else {
          remainder = stepLeft;
        }
      }
      level++;
      length = Math.floor(length / 2) + (move ? 1 : 0);
      if (move) {
        start = 1;
        move = false;
      } else start = 0;
      this.levels.push(length);
    }
  }

  find(id: string): Step | undefined {
    return this.steps.find((obj) => obj.id === id);
  }

  abstract writeSteps(): Promise<void>;
  abstract compute(): Promise<void>;
}

class SumSequencer extends Sequencer {
  result: string[];
  finalResult: string | undefined;
  constructor(jobId: string, transactions: string[]) {
    super(jobId, transactions);
    this.result = [];
  }

  async step(step: Step): Promise<void> {
    let result = 0;
    await sleep(1000);
    if (step.merge) {
      if (step.input.length !== 2) throw new Error("Input length not 2");
      let wait: boolean = true;
      while (wait) {
        await sleep(1000);
        const leftIndex = this.find(step.input[0])?.index;
        const rightIndex = this.find(step.input[1])?.index;
        if (leftIndex === undefined || rightIndex === undefined)
          throw new Error("Index not found");
        const left = Number(this.steps[leftIndex].result);
        const right = Number(this.steps[rightIndex].result);
        if (left !== undefined && right !== undefined) {
          result = left + right;
          wait = false;
        }
        //console.log("SumSequencer: merge", step);
      }
    } else {
      result = Number(step.transaction);
    }
    this.steps[step.index].result = `${result}`;
    this.steps[step.index].status = "finished";
    if (step.final) this.finalResult = `${result}`;
    console.log("SumSequencer: step", step, "result", result);
  }

  async writeSteps(): Promise<void> {
    console.log("SumSequencer: writing steps...");
  }

  async compute(): Promise<void> {
    console.log("SumSequencer: computing...");
    for (let i = 0; i < this.steps.length; i++) {
      this.steps[i].status = "started";
      //this.step(this.steps[i]);
      console.log("SumSequencer: step", this.steps[i]);
    }
  }
}

let sequencer: SumSequencer | undefined = undefined;
let checkSum: number = 0;

describe("Sequencer", () => {
  it("should generate data", async () => {
    console.log("Generating data...");
    const transactions: string[] = [];
    let sum: number = 0;
    for (let i = 0; i < size; i++) {
      const value = Math.floor(Math.random() * 100);
      transactions.push(`${value}`);
      sum += value;
    }
    checkSum = sum;
    sequencer = new SumSequencer("sum-id", transactions);
  });

  it("should prepare data", async () => {
    console.log("Preparing data...");
    expect(sequencer).toBeDefined();
    if (sequencer === undefined) return;
    await sequencer.writeSteps();
  });

  it("should run sequencer", async () => {
    console.log("Running sequencer...");
    expect(sequencer).toBeDefined();
    if (sequencer === undefined) return;
    //console.log("sequencer 0.3", sequencer.find("0.3"));
    await sequencer.compute();
    //while (sequencer.finalResult === undefined) await sleep(1000);
    //console.log("Final result", sequencer.finalResult);
    console.log("Check sum", checkSum);
    //expect(Number(sequencer.finalResult)).toBe(checkSum);
  });
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
