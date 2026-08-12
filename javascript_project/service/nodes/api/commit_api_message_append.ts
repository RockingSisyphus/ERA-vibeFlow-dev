interface Envelope<T> {
  readonly value: T;
}

interface Context {
  readonly capabilities: {
    readonly "era.tavern.messages": {
      readonly update_content: (
        input: Readonly<Record<string, unknown>>,
      ) => Promise<unknown>;
    };
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function run(
  inputs: Readonly<{ "era.api.write.append.request": Envelope<unknown> }>,
  _params: Readonly<Record<string, unknown>>,
  context: Context,
): Promise<any> {
  const request = inputs["era.api.write.append.request"].value;
  if (!isRecord(request) || !isRecord(request.capabilityInput)) {
    throw new TypeError("消息追加请求损坏。");
  }
  try {
    const observed = await context.capabilities[
      "era.tavern.messages"
    ].update_content(request.capabilityInput);
    const response = isRecord(observed) ? observed : {};
    const status = String(response.status ?? "");
    if (
      status === "committed" ||
      status === "completed" ||
      status === "success" ||
      response.ok === true
    ) {
      return {
        api_message_append_result: {
          status: "committed",
          request,
          observed,
        },
      };
    }
    if (status === "failed" && response.applied === false) {
      return {
        api_message_append_result: {
          status: "failed",
          request,
          observed,
          error: {
            code: "ERA_API_MESSAGE_APPEND_REJECTED",
            message: String(response.message ?? "Tavern 明确拒绝消息写入且未应用。"),
          },
        },
      };
    }
    return {
      api_message_append_result: {
        status: "unknown",
        request,
        observed,
        error: {
          code: "ERA_API_MESSAGE_APPEND_UNKNOWN",
          message: "消息 Capability 未返回可确认的提交状态。",
        },
      },
    };
  } catch (error) {
    // Capability 抛出时不能证明宿主是否已经应用局部写入，因此必须进入 fatal。
    return {
      api_message_append_result: {
        status: "unknown",
        request,
        error: {
          code: "ERA_API_MESSAGE_APPEND_UNKNOWN",
          message: errorMessage(error),
        },
      },
    };
  }
}
