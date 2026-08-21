import { canPersist, inspectSidecar, recordFor } from "../../base_lib/sidecar_binding.ts";
interface Ctx { readonly capabilities: { readonly "era.tavern.sidecar": { read_current(input: Readonly<Record<string, unknown>>): Promise<unknown>; read_record(input: Readonly<Record<string, unknown>>): Promise<unknown>; write_record(input: Readonly<Record<string, unknown>>): Promise<unknown>; present_prompt(input: Readonly<Record<string, unknown>>): unknown } } }
export async function run(inputs: Readonly<{ "era.tavern.commit.result": { readonly value: unknown } }>, _params: Readonly<Record<string, unknown>>, context: Ctx): Promise<any> {
  const commit = inputs["era.tavern.commit.result"].value;
  if (!canPersist(commit)) return {};
  const current = await context.capabilities["era.tavern.sidecar"].read_current({});
  const meta = (current as Record<string, unknown>).meta as Record<string, unknown> | null; const id = meta?.SidecarId;
  const rawRecord = typeof id === "string" ? await context.capabilities["era.tavern.sidecar"].read_record({ sidecarId: id }) : null;
  const facts = inspectSidecar(current, rawRecord);
  if (facts.status === "matched" && facts.current !== null && facts.record !== null) {
    try {
      await context.capabilities["era.tavern.sidecar"].write_record({ sidecarId: facts.record.sidecarId, record: recordFor(facts.record.sidecarId, facts.current, (current as Record<string, unknown>).stat, facts.record) });
    } catch {
      // 聊天变量已经完成正规提交，不能回滚或将其伪装为文件已同步。仅发布
      // 强制修复入口；下一次用户显式 repair 会重新读取当前身份和 revision。
      context.capabilities["era.tavern.sidecar"].present_prompt({
        prompt: {
          kind: "repair",
          sidecarId: facts.record.sidecarId,
          current: facts.current,
          owner: facts.record.owner,
          revision: facts.record.revision,
          reason: "sidecar-record-write-failed",
        },
      });
    }
  }
  return {};
}
