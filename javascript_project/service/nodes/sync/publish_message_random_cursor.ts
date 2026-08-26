/** Publish only an audit view of the ephemeral draw cursor without duplicating the command result. */
export function run(inputs: any): any {
  const result = inputs["era.expression.command.result"].value ?? {};
  return {
    message_random_cursor_report: {
      randomDrawsConsumed: result.randomDrawsConsumed ?? 0,
      nextRandomDrawOffset: result.nextRandomDrawOffset ?? 0,
    },
  };
}
