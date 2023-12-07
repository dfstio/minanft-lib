export { BackendPlugin };
import type { Cache, VerificationKey } from "o1js";

abstract class BackendPlugin {
  name: string;
  task: string;
  args: string[];

  constructor(params: { name: string; task: string; args: string[] }) {
    const { name, task, args } = params;
    this.name = name;
    this.task = task;
    this.args = args;
  }

  abstract compile(cache: Cache): Promise<VerificationKey[] | undefined>;
  abstract create(transaction: string): Promise<string | undefined>;
  abstract merge(proof1: string, proof2: string): Promise<string | undefined>;
}
