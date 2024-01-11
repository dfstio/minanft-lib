export { BaseMinaNFTObject, MinaNFTObjectType };
import { Field } from "o1js";
type MinaNFTObjectType = "string" | "text" | "file" | "map" | "image";

abstract class BaseMinaNFTObject {
  root: Field;
  type: MinaNFTObjectType;
  public abstract toJSON(): object;
  constructor(type: MinaNFTObjectType) {
    this.root = Field.from(0);
    this.type = type;
  }
}
