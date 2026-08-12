interface Envelope<T> {
  readonly value: T;
}

interface IdentityInputs {
  readonly "era.macro.substring.checked": Envelope<string>;
}

export function run(inputs: IdentityInputs): {
  readonly "macro.replacement.identity": string;
} {
  return {
    "macro.replacement.identity":
      inputs["era.macro.substring.checked"].value,
  };
}
