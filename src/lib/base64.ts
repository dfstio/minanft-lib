import { Field } from "o1js";

const TABLE =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function fieldToBase64(field: Field): string {
  const digits = toBase(field.toBigInt(), BigInt(64));
  //console.log("digits:", digits);
  const str = digits.map((x) => TABLE[Number(x)]).join("");
  //console.log("str:", str);
  return str;
}

export function bigintToBase64(value: bigint): string {
  const digits = toBase(value, BigInt(64));
  //console.log("digits:", digits);
  const str = digits.map((x) => TABLE[Number(x)]).join("");
  //console.log("str:", str);
  return str;
}

export function fieldFromBase64(str: string): Field {
  const base64Digits = str.split("").map((x) => BigInt(TABLE.indexOf(x)));
  const x = fromBase(base64Digits, BigInt(64));
  return Field(x);
}

export function bigintFromBase64(str: string): bigint {
  const base64Digits = str.split("").map((x) => BigInt(TABLE.indexOf(x)));
  const x = fromBase(base64Digits, BigInt(64));
  return x;
}

function fromBase(digits: bigint[], base: bigint) {
  if (base <= BigInt(0)) throw Error("fromBase: base must be positive");
  // compute powers base, base^2, base^4, ..., base^(2^k)
  // with largest k s.t. n = 2^k < digits.length
  let basePowers = [];
  for (
    let power = base, n = 1;
    n < digits.length;
    power **= BigInt(2), n *= 2
  ) {
    basePowers.push(power);
  }
  let k = basePowers.length;
  // pad digits array with zeros s.t. digits.length === 2^k
  digits = digits.concat(Array(2 ** k - digits.length).fill(0n));
  // accumulate [x0, x1, x2, x3, ...] -> [x0 + base*x1, x2 + base*x3, ...] -> [x0 + base*x1 + base^2*(x2 + base*x3), ...] -> ...
  // until we end up with a single element
  for (let i = 0; i < k; i++) {
    let newDigits = Array(digits.length >> 1);
    let basePower = basePowers[i];
    for (let j = 0; j < newDigits.length; j++) {
      newDigits[j] = digits[2 * j] + basePower * digits[2 * j + 1];
    }
    digits = newDigits;
  }
  console.assert(digits.length === 1);
  let [digit] = digits;
  return digit;
}

function toBase(x: bigint, base: bigint) {
  if (base <= 0n) throw Error("toBase: base must be positive");
  // compute powers base, base^2, base^4, ..., base^(2^k)
  // with largest k s.t. base^(2^k) < x
  let basePowers = [];
  for (let power = base; power <= x; power **= 2n) {
    basePowers.push(power);
  }
  let digits = [x]; // single digit w.r.t base^(2^(k+1))
  // successively split digits w.r.t. base^(2^j) into digits w.r.t. base^(2^(j-1))
  // until we arrive at digits w.r.t. base
  let k = basePowers.length;
  for (let i = 0; i < k; i++) {
    let newDigits = Array(2 * digits.length);
    let basePower = basePowers[k - 1 - i];
    for (let j = 0; j < digits.length; j++) {
      let x = digits[j];
      let high = x / basePower;
      newDigits[2 * j + 1] = high;
      newDigits[2 * j] = x - high * basePower;
    }
    digits = newDigits;
  }
  // pop "leading" zero digits
  while (digits[digits.length - 1] === 0n) {
    digits.pop();
  }
  return digits;
}
