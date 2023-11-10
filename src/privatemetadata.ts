export { PrivateMetadata };
import { Field } from "o1js";
import { MinaNFT } from "./minanft";
import { BaseMinaNFTObject } from "./baseminanftobject";

class PrivateMetadata {
  data: Field;
  kind: Field;
  isPrivate: boolean;
  linkedObject?: BaseMinaNFTObject;

  constructor(value: {
    data: Field;
    kind: Field;
    isPrivate?: boolean;
    linkedObject?: BaseMinaNFTObject;
  }) {
    this.data = value.data;
    this.kind = value.kind;
    this.isPrivate = value.isPrivate ?? false;
    this.linkedObject = value.linkedObject;
  }
  public toJSON(): object {
    const kind = MinaNFT.stringFromField(this.kind);
    let data: string;
    if (kind === "string") data = MinaNFT.stringFromField(this.data);
    else data = this.data.toJSON();
    const isPrivate: boolean | undefined =
      this.isPrivate === true ? true : undefined;
    return {
      data,
      kind,
      isPrivate,
      linkedObject: this.linkedObject?.toJSON(),
    };
  }
}
