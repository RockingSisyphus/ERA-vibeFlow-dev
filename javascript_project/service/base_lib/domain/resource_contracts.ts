/**
 * ERA 初始化资源的纯规划器。
 *
 * 本模块只接收已经规范化为 JSON 的宿主快照，并返回声明式计划；不会读取
 * Tavern、DOM、文件、时间、随机数或任何模块级可变状态，也不会执行写入。
 */

export type EraJsonPrimitive = string | number | boolean | null;
export type EraJsonValue =
  | EraJsonPrimitive
  | readonly EraJsonValue[]
  | { readonly [key: string]: EraJsonValue };

export interface EraSettingsV1 {
  readonly 在ai消息尾部生成特殊符号: boolean;
  readonly 特殊符号值: string;
  readonly 开启悬浮球: boolean;
  readonly 开启黑夜模式: boolean;
  readonly 历史状态栏显示范围: number;
  readonly 历史状态栏超出范围行为: "placeholder" | "empty" | "hidden";
  readonly 繁体转简体: boolean;
  readonly 调试模式: boolean;
}

export interface EraSettingsIssueV1 {
  readonly field: string;
  readonly expected: "boolean" | "number" | "string" | "object";
  readonly actual: string;
}

export type EraSettingsPlanV1 =
  | {
      readonly kind: "settings";
      readonly status: "ready";
      readonly settings: EraSettingsV1;
      readonly removedUnknownKeys: readonly string[];
      readonly actions: readonly [
        {
          readonly kind: "replace-settings";
          readonly settings: EraSettingsV1;
        },
      ];
    }
  | {
      readonly kind: "settings";
      readonly status: "invalid";
      readonly error: {
        readonly code: "ERA_SETTINGS_INVALID";
        readonly message: string;
        readonly issues: readonly EraSettingsIssueV1[];
      };
      readonly actions: readonly [];
    };

export type EraCharacterContextV1 =
  | {
      readonly kind: "character";
      readonly characterName: string;
      readonly primaryWorldbook: string | null;
      readonly additionalWorldbooks: readonly string[];
    }
  | { readonly kind: "group-chat"; readonly groupName?: string }
  | { readonly kind: "no-character" };

export interface EraGreetingPlanInputV1 {
  readonly mode?: "traditional" | "external";
  readonly context: EraCharacterContextV1;
  readonly firstMessage: string | null;
}

export type EraGreetingPlanV1 =
  | {
      readonly kind: "greeting";
      readonly status: "created";
      readonly expected: string;
      readonly next: string;
    }
  | {
      readonly kind: "greeting";
      readonly status: "unchanged" | "skipped";
      readonly reason: string;
    };

export interface EraWorldbookEntryV1 {
  readonly name: string;
  readonly content: string;
  readonly enabled: true;
  readonly strategy: {
    readonly type: "constant";
    readonly keys: readonly [];
    readonly keys_secondary: {
      readonly logic: "and_any";
      readonly keys: readonly [];
    };
    readonly scan_depth: "same_as_global";
  };
  readonly position: {
    readonly type: "at_depth";
    readonly role: "system";
    readonly depth: 0;
    readonly order: 9999 | 9998;
  };
  readonly probability: 100;
  readonly recursion: {
    readonly prevent_incoming: false;
    readonly prevent_outgoing: false;
    readonly delay_until: null;
  };
  readonly effect: {
    readonly sticky: null;
    readonly cooldown: null;
    readonly delay: null;
  };
}

export interface EraWorldbookPlanInputV1 {
  readonly context: EraCharacterContextV1;
  readonly existingWorldbookNames: readonly string[];
  readonly primaryEntries: readonly unknown[];
}

export type EraWorldbookActionV1 =
  | { readonly kind: "create-worldbook"; readonly worldbookName: string }
  | {
      readonly kind: "bind-primary-worldbook";
      readonly characterName: string;
      readonly worldbookName: string;
      readonly additionalWorldbooks: readonly string[];
    }
  | {
      readonly kind: "create-entry";
      readonly worldbookName: string;
      readonly entry: EraWorldbookEntryV1;
    };

export interface EraWorldbookEntryPlanV1 {
  readonly entryName: string;
  readonly status: "planned" | "exists";
}

export type EraWorldbookPlanV1 =
  | {
      readonly kind: "worldbook";
      readonly status: "ready";
      readonly worldbookName: string;
      readonly createdPrimary: boolean;
      readonly details: readonly EraWorldbookEntryPlanV1[];
      readonly actions: readonly EraWorldbookActionV1[];
    }
  | {
      readonly kind: "worldbook";
      readonly status: "skipped" | "conflict";
      readonly reason: string;
      readonly details: readonly [];
      readonly actions: readonly [];
    };

export interface EraRegexPayloadV1 {
  readonly script_name: string;
  readonly enabled: true;
  readonly run_on_edit: true;
  readonly find_regex: string;
  readonly replace_string: string;
  readonly trim_strings: readonly [];
  readonly source: {
    readonly user_input: boolean;
    readonly ai_output: boolean;
    readonly slash_command: false;
    readonly world_info: false;
    readonly reasoning: false;
  };
  readonly destination: {
    readonly display: boolean;
    readonly prompt: boolean;
  };
  readonly min_depth: null;
  readonly max_depth: null;
}

export interface EraRegexPlanInputV1 {
  readonly context: EraCharacterContextV1;
  readonly localRegexEnabled: boolean;
  readonly existingRegexes: readonly unknown[];
}

export interface EraRegexDetailV1 {
  readonly regexName: string;
  readonly status: "planned" | "exists";
  readonly compatibility?: "managed-v2" | "legacy-unmanaged";
}

export type EraRegexPlanV1 =
  | {
      readonly kind: "regex";
      readonly status: "ready";
      readonly details: readonly EraRegexDetailV1[];
      readonly actions: readonly {
        readonly kind: "upsert-missing-regex";
        readonly regex: EraRegexPayloadV1;
      }[];
    }
  | {
      readonly kind: "regex";
      readonly status: "skipped";
      readonly reason: string;
      readonly details: readonly [];
      readonly actions: readonly [];
    };

export type EraPlaceholderMessageV1 =
  | { readonly kind: "missing"; readonly messageId: number }
  | {
      readonly kind: "present";
      readonly messageId: number;
      readonly role: "assistant" | "user" | "unknown";
      readonly textContent: string | null;
      readonly attachments?: readonly EraJsonValue[];
    };

export interface EraPlaceholderPlanInputV1 {
  readonly enabled: boolean;
  readonly placeholder: string;
  readonly message: EraPlaceholderMessageV1;
}

export type EraPlaceholderPlanV1 =
  | {
      readonly kind: "placeholder";
      readonly status: "update";
      readonly messageId: number;
      readonly textContent: string;
      readonly actions: readonly [
        {
          readonly kind: "update-message-text";
          readonly messageId: number;
          readonly textContent: string;
        },
      ];
    }
  | {
      readonly kind: "placeholder";
      readonly status: "skipped" | "exists";
      readonly reason: string;
      readonly actions: readonly [];
    };
