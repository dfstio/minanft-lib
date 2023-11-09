export { BaseMinaNFTObject };
import { Field } from "o1js";

abstract class BaseMinaNFTObject {
  root: Field;
  type: string;
  public abstract toJSON(): object;
  public abstract fromJSON(json: object): void;
  constructor(type: string) {
    this.root = Field.from(0);
    this.type = type;
  }
}
