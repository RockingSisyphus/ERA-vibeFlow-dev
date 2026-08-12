interface Envelope<T> {
  readonly value: T;
}

interface OutputJoinInputs {
  readonly "era.macro.replacement.candidate": Envelope<string>;
}

export function run(inputs: OutputJoinInputs): {
  readonly "macro.replacement": string;
} {
  return {
    "macro.replacement":
      inputs["era.macro.replacement.candidate"].value,
  };
}
