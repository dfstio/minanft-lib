import { Field, Bool, Provable } from "o1js";
import { InferProvable, provable, Struct, FlexibleProvable } from "o1js";

export type Option<T, V = any> = { isSome: Bool; value: T } & {
  assertSome(message?: string): T;
  orElse(defaultValue: T | V): T;
};

type OptionOrValue<T, V> =
  | { isSome: boolean | Bool; value: T | V }
  | T
  | V
  | undefined;

function emptyValue<T>(type: FlexibleProvable<T>): T;
function emptyValue<T>(type: Provable<T>) {
  return type.fromFields(
    Array(type.sizeInFields()).fill(Field(0)),
    type.toAuxiliary()
  );
}

/**
 * Define an optional version of a provable type.
 *
 * @example
 * ```ts
 * class OptionUInt64 extends Option(UInt64) {}
 *
 * // create an optional UInt64
 * let some = OptionUInt64.from(5n);
 * let none = OptionUInt64.none();
 *
 * // get back a UInt64
 * let five: UInt64 = some.assertSome('must have a value');
 * let zero: UInt64 = none.orElse(0n); // specify a default value
 * ```
 */
export function OptionFunction<A extends Provable<any, any>>(
  type: A
): Provable<
  Option<InferProvable<A>, InferValue<A>>,
  InferValue<A> | undefined
> & {
  fromValue(
    value:
      | { isSome: boolean | Bool; value: InferProvable<A> | InferValue<A> }
      | InferProvable<A>
      | InferValue<A>
      | undefined
  ): Option<InferProvable<A>, InferValue<A>>;
  from(
    value?: InferProvable<A> | InferValue<A>
  ): Option<InferProvable<A>, InferValue<A>>;
  none(): Option<InferProvable<A>, InferValue<A>>;
} {
  type T = InferProvable<A>;
  type V = InferValue<A>;
  let strictType: Provable<T, V> = type;

  // construct a provable with a JS type of `T | undefined`
  const PlainOption: Provable<
    { isSome: Bool; value: T },
    { isSome: boolean; value: V }
  > = provable({ isSome: Bool, value: strictType });

  const RawOption = {
    ...PlainOption,

    toValue({ isSome, value }: { isSome: Bool; value: T }) {
      return isSome.toBoolean() ? strictType.toValue(value) : undefined;
    },

    fromValue(value: OptionOrValue<T, V>) {
      if (value === undefined)
        return { isSome: Bool(false), value: emptyValue(strictType) };
      // TODO: this isn't 100% robust. We would need recursive type validation on any nested objects to make it work
      if (typeof value === "object" && "isSome" in value)
        return PlainOption.fromValue(value as any); // type-cast here is ok, matches implementation
      return { isSome: Bool(true), value: strictType.fromValue(value) };
    },
  };

  const Super = Struct(RawOption);
  return class Option_ extends Super {
    orElse(defaultValue: T | V): T {
      return Provable.if(
        this.isSome,
        strictType,
        this.value,
        strictType.fromValue(defaultValue)
      );
    }

    assertSome(message?: string): T {
      this.isSome.assertTrue(message);
      return this.value;
    }

    static from(value?: V | T) {
      return value === undefined
        ? new Option_({ isSome: Bool(false), value: emptyValue(strictType) })
        : new Option_({
            isSome: Bool(true),
            value: strictType.fromValue(value),
          });
    }
    static none() {
      return Option_.from(undefined);
    }

    static fromFields(fields: any[], aux?: any): Option_ {
      return new Option_(Super.fromFields(fields, aux));
    }
    static fromValue(value: OptionOrValue<T, V>) {
      return new Option_(Super.fromValue(value));
    }
  };
}

type Primitive =
  | typeof String
  | typeof Number
  | typeof Boolean
  | typeof BigInt
  | null
  | undefined;

type InferPrimitiveValue<P extends Primitive> = P extends typeof String
  ? string
  : P extends typeof Number
  ? number
  : P extends typeof Boolean
  ? boolean
  : P extends typeof BigInt
  ? bigint
  : P extends null
  ? null
  : P extends undefined
  ? undefined
  : any;

type GenericProvable<T, TValue, Field> = {
  toFields: (x: T) => Field[];
  toAuxiliary: (x?: T) => any[];
  fromFields: (x: Field[], aux: any[]) => T;
  sizeInFields(): number;
  check: (x: T) => void;
  toValue: (x: T) => TValue;
  fromValue: (x: T | TValue) => T;
};

type Tuple<T> = [T, ...T[]] | [];

export type InferValue<A> = A extends GenericProvable<any, infer U, any>
  ? U
  : A extends Primitive
  ? InferPrimitiveValue<A>
  : A extends Tuple<any>
  ? {
      [I in keyof A]: InferValue<A[I]>;
    }
  : A extends (infer U)[]
  ? InferValue<U>[]
  : A extends Record<any, any>
  ? {
      [K in keyof A]: InferValue<A[K]>;
    }
  : never;

// swap two values if the boolean is false, otherwise keep them as they are
// more efficient than 2x `Provable.if()` by reusing an intermediate variable
export function conditionalSwap(b: Bool, x: Field, y: Field): [Field, Field] {
  let m = b.toField().mul(x.sub(y)); // b*(x - y)
  const x_ = y.add(m); // y + b*(x - y)
  const y_ = x.sub(m); // x - b*(x - y) = x + b*(y - x)
  return [x_, y_];
}

/**
 * Assert that a statement is true. If the statement is false, throws an error with the given message.
 * Can be used in provable code.
 */
export function assert(stmt: boolean | Bool, message?: string): asserts stmt {
  if (typeof stmt === "boolean") {
    if (!stmt) throw Error(message ?? "Assertion failed");
  } else {
    stmt.assertTrue(message ?? "Assertion failed");
  }
}
