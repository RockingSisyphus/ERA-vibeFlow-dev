// Generated from Service base_lib/snapshot; do not edit.
export interface SidecarRuntimeIdentity {
    readonly characterId: string | null;
    readonly groupId: string | null;
    readonly chatId: string;
}
/**
 * 宏可读取的当前页面易失缓存：只能由成功文件事务发布，不能充当持久化来源。
 */
export interface SidecarRuntimeSnapshot {
    readonly identity: SidecarRuntimeIdentity;
    readonly sidecarId: string;
    readonly revision: number;
    readonly statData: unknown;
    readonly statFunc: Record<string, unknown>;
    readonly eraMeta: Record<string, unknown>;
}
export interface EraPublicState {
    readonly status: 'ready' | 'loading';
    readonly identity: SidecarRuntimeSnapshot['identity'] | null;
    readonly sidecarId: string | null;
    readonly revision: number | null;
    readonly statData: unknown;
    readonly statFunc: Readonly<Record<string, unknown>>;
    readonly eraMeta: Readonly<Record<string, unknown>>;
    readonly stat: unknown;
    readonly statWithoutMeta: unknown;
    readonly selectedMks: readonly (string | null)[];
    readonly editLogs: Readonly<Record<string, unknown>>;
    readonly functionEditLogs: Readonly<Record<string, unknown>>;
    readonly mk: string | null;
    readonly message_id: number | null;
    readonly is_user: false;
}
/**
 * 把内部快照裁剪为稳定、深拷贝且不可写的作者视图。
 * 必须拷贝全部对象字段，否则状态栏脚本可绕过 Service 直接篡改 Sidecar。
 */
export declare function projectPublicState(snapshot: SidecarRuntimeSnapshot | null, floor?: Readonly<{
    messageId: number;
    mk: string;
    stat: unknown;
    statFunc: Readonly<Record<string, unknown>>;
}>): EraPublicState;
