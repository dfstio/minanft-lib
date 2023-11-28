export { BaseMinaNFTObject };
import { Field } from "o1js";

abstract class BaseMinaNFTObject {
  root: Field;
  type: string;
  public abstract toJSON(): object;
  constructor(type: string) {
    this.root = Field.from(0);
    this.type = type;
  }
}
