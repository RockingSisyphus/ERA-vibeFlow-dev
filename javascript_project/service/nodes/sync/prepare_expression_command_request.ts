interface Envelope<T> { readonly value: T; }

/**
 * The Service keeps Tavern DTO preparation here.  Parser/AST/function semantics are never
 * copied across this boundary: the following Nodeset delegates them to the expression package.
 */
export function run(inputs: Readonly<{ "era.sync.context": Envelope<unknown> }>): any {
  return {
    expression_command_request: inputs["era.sync.context"].value as Readonly<Record<string, unknown>>,
  };
}
