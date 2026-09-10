/** 保存角色卡之后的当前聊天事实及原刷新决策。 */
export type GreetingRefreshResult = Readonly<{ status: 'refreshed' | 'preserved' | 'not-applicable'; reason: string }>;
export type GreetingRefreshTarget = Readonly<{ kind: 'result'; result: GreetingRefreshResult }> | Readonly<{ kind: 'empty' }> | Readonly<{ kind: 'message'; updated: string }>;
export interface GreetingRefreshFacts {
  readonly group: boolean; readonly tainted: boolean; readonly length: number;
  readonly first: { readonly is_user: boolean; readonly is_system: boolean; readonly swipe_id: number; readonly primary: string; readonly mes: string } | null;
}
function preserved(reason: string): GreetingRefreshResult {
  return { status: 'preserved', reason };
}

function stripEraManagedGreetingSuffix(value: string): string {
  const suffixes = [
    /\s*<StatusPlaceHolderImpl\s*\/>\s*$/i,
    /\s*<era_data(?:\s[^>]*)?>[\s\S]*?<\/era_data>\s*$/i,
  ] as const;
  let stripped = value;
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of suffixes) {
      const next = stripped.replace(suffix, '');
      if (next !== stripped) {
        stripped = next;
        changed = true;
      }
    }
  }
  return stripped;
}

export function planGreetingRefresh(expected: string, next: string, facts: GreetingRefreshFacts): GreetingRefreshTarget {
  if (facts.group) {
    return { kind: 'result', result: { status: 'not-applicable', reason: '群聊不支持单角色主开场白刷新。' } };
  }
  if (!next.startsWith(expected)) {
    return { kind: 'result', result: preserved('更新后的主开场白不是原文追加，当前聊天未修改。') };
  }
  if (facts.tainted === true) {
    return { kind: 'result', result: preserved('当前聊天已被宿主标记为修改过。') };
  }
  if (facts.length > 1) return { kind: 'result', result: preserved('当前聊天已有多楼历史。') };
  if (facts.length === 0) return { kind: 'empty' };

  const message = facts.first!;
  if (message.is_user || message.is_system) {
    return { kind: 'result', result: preserved('首楼不是角色主开场白。') };
  }
  if ((message.swipe_id ?? 0) !== 0) {
    return { kind: 'result', result: preserved('首楼当前显示的是备用开场白。') };
  }
  const primary = message.primary;
  if (stripEraManagedGreetingSuffix(primary) !== expected || stripEraManagedGreetingSuffix(message.mes) !== expected) {
    return { kind: 'result', result: preserved('首楼内容已不等于角色卡原主开场白。') };
  }
  return { kind: 'message', updated: next };
}

