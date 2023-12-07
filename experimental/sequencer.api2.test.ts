import { describe, expect, it } from "@jest/globals";
import api from "../src/api/api";
import { JWT } from "../env.json";
import { formatTime } from "../src/mina";

const delay: number = 1; // ms
const size = 64;

interface Step {
  jobId: string;
  id: number;
  merge: boolean;
  transaction: string;
  input: string[];
  status: "created" | "started" | "finished" | "used";
  result?: string;
}

class Sequencer {
  jobId: string;
  transactions: string[];
  steps: Step[] = [];
  index: number = 0;

  constructor(jobId: string, transactions: string[]) {
    this.jobId = jobId;
    this.transactions = transactions;
    this.prepareSteps();
  }

  private prepareSteps() {
    for (let i = 0; i < this.transactions.length; i++) {
      const step: Step = {
        jobId: this.jobId,
        id: this.index++,
        status: "created",
        merge: false,
        transaction: this.transactions[i],
        input: [],
      };
      //console.log("create step", step);
      this.steps.push(step);
    }
  }

  checkResults(): string | undefined {
    const finished: Step[] = this.steps.filter(
      (obj) => obj.status === "finished"
    );
    const length = Math.floor(finished.length / 2);
    //console.log("checkResults", finished.length, length);
    if (length > 0) {
      for (let i = 0; i < length; i++) {
        this.steps[finished[i * 2].id].status = "used";
        this.steps[finished[i * 2 + 1].id].status = "used";
        const result1: string | undefined = finished[i * 2].result;
        const result2: string | undefined = finished[i * 2 + 1].result;
        if (result1 === undefined || result2 === undefined)
          throw new Error("Result undefined");
        const step: Step = {
          jobId: this.jobId,
          id: this.index++,
          status: "created",
          merge: true,
          transaction: "",
          input: [result1, result2],
        };
        //console.log("merge step", step);
        this.steps.push(step);
      }
    } else {
      if (
        this.steps.every(
          (obj) => obj.status === "finished" || obj.status === "used"
        ) &&
        finished.length === 1
      ) {
        this.steps[finished[0].id].status = "used";
        if (finished[0].result === undefined)
          throw new Error("Result undefined");
        return finished[0].result;
      }
    }
    return undefined;
  }
}

class SumSequencer extends Sequencer {
  constructor(jobId: string, transactions: string[]) {
    super(jobId, transactions);
  }

  async step(step: Step): Promise<void> {
    let result = 0;
    if (step.merge) {
      if (step.input.length !== 2) throw new Error("Input length not 2");
      result = Number(step.input[0]) + Number(step.input[1]);
    } else {
      result = Number(step.transaction);
    }
    this.steps[step.id].result = `${result}`;
    this.steps[step.id].status = "finished";
    //console.log("SumSequencer: step", step, "result", result);
  }

  async writeSteps(): Promise<void> {
    //console.log("SumSequencer: writing steps...");
  }

  async compute(): Promise<string> {
    //console.log("SumSequencer: computing...");
    let result: string | undefined = undefined;
    while (result === undefined) {
      const created: Step[] = this.steps.filter(
        (obj) => obj.status === "created"
      );
      for (let i = 0; i < created.length; i++) {
        this.steps[created[i].id].status = "started";
        this.step(created[i]);
      }
      await sleep(delay);
      result = this.checkResults();
    }
    return result;
  }
}

let sequencer: SumSequencer | undefined = undefined;
let checkSum: number = 0;
const transactions: string[] = [];

describe("Sequencer", () => {
  it("should run and test sequencer", async () => {
    console.log("Generating data...");
    let sum: number = 0;
    for (let i = 0; i < size; i++) {
      const value = Math.floor(Math.random() * 1000);
      transactions.push(`${value}`);
      sum += value;
    }
    checkSum = sum;
    sequencer = new SumSequencer("sum-id", transactions);

    const result: string = await sequencer.compute();
    console.log("Final result", result);
    console.log("Check sum", checkSum);
    if (Number(result) !== checkSum)
      console.log("ERROR", size, result, checkSum);
    expect(Number(result)).toBe(checkSum);
  });

  it("should call sum api v2", async () => {
    const minanft = new api(JWT);
    const apiresult = await minanft.sum_v2({
      transactions,
      task: "sum",
      arguments: [],
    });
    console.log("api result", apiresult);
    expect(apiresult.success).toBe(true);
    expect(apiresult.jobId).toBeDefined();
    if (apiresult.jobId === undefined) return;
    //expect(Number(apiresult.jobId)).toBe(checkSum);
    console.time("sum_v2_result");
    let ready: boolean = false;
    while (!ready) {
      await sleep(5000);
      const result = await minanft.sum_v2_result({ jobId: apiresult.jobId });
      if (result.success) {
        if (result.result.result !== undefined) {
          ready = true;
          console.log("status", result);
          console.log("Final result", result.result.result);
          console.log(
            "Billed duration",
            formatTime(result.result.billedDuration)
          );
          expect(Number(result.result.result)).toBe(checkSum);
        }
      }
    }
    console.timeEnd("sum_v2_result");
  });
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
