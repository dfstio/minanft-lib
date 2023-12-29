export { BackendPlugin };
import type { Cache } from "o1js";

abstract class BackendPlugin {
  name: string;
  task: string;
  args: string[];
  jobId?: string;

  constructor(params: {
    name: string;
    task: string;
    args: string[];
    jobId?: string;
  }) {
    const { name, task, args, jobId } = params;
    this.name = name;
    this.task = task;
    this.args = args;
    this.jobId = jobId;
  }

  abstract compile(cache: Cache): Promise<void>;
  abstract create(transaction: string): Promise<string | undefined>;
  abstract merge(proof1: string, proof2: string): Promise<string | undefined>;

  abstract send(transaction: string): Promise<string | undefined>;
  abstract mint(transaction: string): Promise<string | undefined>;
  abstract verify(proof: string): Promise<string | undefined>;
}
