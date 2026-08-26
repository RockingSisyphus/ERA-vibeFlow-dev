/**
 * Keep the already prepared pure sync DTO on the expression bridge.  The domain engine
 * derives a fresh per-message cursor from each MK while replaying, so this node deliberately
 * performs no host I/O and creates no persistent random state.
 */
export function run(inputs: any): any {
  return {
    message_random_command_request:
      inputs["era.expression.command.request"].value,
  };
}
