interface Envelope<T> {
  readonly value: T;
}

interface AdaptOutputInputs {
  readonly "era.macro.replacement.internal": Envelope<string>;
}

export function run(inputs: AdaptOutputInputs): {
  readonly "macro.replacement.rendered": string;
} {
  return {
    "macro.replacement.rendered":
      inputs["era.macro.replacement.internal"].value,
  };
}
