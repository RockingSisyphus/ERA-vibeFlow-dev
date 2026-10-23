import {defineNode} from "@vibeflow/plugin";

export const era_tavern_barrier_wait_await_handoff = defineNode({
  "display_name": "正常等待完成后再等生成阶段交接",
  "description": "相关事件已完成，且生成前等待没有发生报告异常时，等待当前已登记的阶段交接结束。让随后生成使用已完成阶段的状态；已标记等待异常时直接交给后续收尾。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.barrier_wait.report_barrier","cardinality":"exactly_one","display_name":"正常等待完成后再等生成阶段交接的请求和已有进度"}],"provides":[{"key":"era_tavern_barrier_wait_await_handoff_frame","type":"era.tavern.frame.barrier_wait.await_handoff","display_name":"正常等待完成后再等生成阶段交接的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_barrier_wait_await_handoff_frame"}},"input_semantics":{"era.tavern.frame.barrier_wait.report_barrier":["保留“正常等待完成后再等生成阶段交接”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_barrier_wait_await_handoff_frame":["保留“正常等待完成后再等生成阶段交接”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/barrier.ts","export":"AwaitHandoff"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.barrier_wait.await_handoff",
  "node_type": "vibeflow.node"
});

export const era_tavern_barrier_wait_await_receipts = defineNode({
  "display_name": "等待指定范围内的事件全部处理结束",
  "description": "接收已确定的事件范围，等待各项实际处理确认，再按先后顺序汇总成功、失败和取消。生成等待中的异常保留给后续报告，其余调用按实际错误返回。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"等待指定范围内的事件全部处理结束的请求和已有进度"}],"provides":[{"key":"era_tavern_barrier_wait_await_receipts_frame","type":"era.tavern.frame.barrier_wait.await_receipts","display_name":"等待指定范围内的事件全部处理结束的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_barrier_wait_await_receipts_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“等待指定范围内的事件全部处理结束”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_barrier_wait_await_receipts_frame":["保留“等待指定范围内的事件全部处理结束”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/barrier.ts","export":"AwaitReceipts"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.barrier_wait.await_receipts",
  "node_type": "vibeflow.node"
});

export const era_tavern_barrier_wait_cleanup_watchdog = defineNode({
  "display_name": "等待结束后清理提醒和已消费失败",
  "description": "本次事件等待结束后，取消对应的超时告警安排，并移除本次范围内已经汇总的失败记录。避免后续生成重复报告相同问题，计时告警本身不会提前放行等待。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.barrier_wait.await_handoff","cardinality":"exactly_one","display_name":"等待结束后清理提醒和已消费失败的请求和已有进度"}],"provides":[{"key":"era_tavern_barrier_wait_cleanup_watchdog_frame","type":"era.tavern.call.frame","display_name":"等待结束后清理提醒和已消费失败的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_barrier_wait_cleanup_watchdog_frame"}},"input_semantics":{"era.tavern.frame.barrier_wait.await_handoff":["保留“等待结束后清理提醒和已消费失败”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_barrier_wait_cleanup_watchdog_frame":["保留“等待结束后清理提醒和已消费失败”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/barrier.ts","export":"CleanupWatchdog"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.barrier_wait.cleanup_watchdog",
  "node_type": "vibeflow.node"
});

export const era_tavern_barrier_wait_report_barrier = defineNode({
  "display_name": "报告生成前等待发现的失败",
  "description": "生成前相关事件结束后，将失败结论交给页面的等待失败处理。等待或失败报告本身发生异常时记录错误，并标记本次等待异常；后续据此决定是否继续等阶段交接。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.barrier_wait.await_receipts","cardinality":"exactly_one","display_name":"报告生成前等待发现的失败的请求和已有进度"}],"provides":[{"key":"era_tavern_barrier_wait_report_barrier_frame","type":"era.tavern.frame.barrier_wait.report_barrier","display_name":"报告生成前等待发现的失败的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_barrier_wait_report_barrier_frame"}},"input_semantics":{"era.tavern.frame.barrier_wait.await_receipts":["保留“报告生成前等待发现的失败”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_barrier_wait_report_barrier_frame":["保留“报告生成前等待发现的失败”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/barrier.ts","export":"ReportBarrier"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.receipts","era.tavern.resources"],
  "id": "era.tavern.barrier_wait.report_barrier",
  "node_type": "vibeflow.node"
});

export const era_tavern_barrier_wait_snapshot_receipts = defineNode({
  "display_name": "确定开始生成前需要等哪些事件",
  "description": "记录指定事件序号及之前仍在处理或曾失败的事件，保留本次等待的起点。后续只等待这段已经确定的范围，确保生成使用相关事件处理后的状态。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"确定开始生成前需要等哪些事件的请求和已有进度"}],"provides":[{"key":"era_tavern_barrier_wait_snapshot_receipts_frame","type":"era.tavern.frame.barrier_wait.snapshot_receipts","display_name":"确定开始生成前需要等哪些事件的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_barrier_wait_snapshot_receipts_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“确定开始生成前需要等哪些事件”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_barrier_wait_snapshot_receipts_frame":["保留“确定开始生成前需要等哪些事件”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/barrier.ts","export":"SnapshotReceipts"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.barrier_wait.snapshot_receipts",
  "node_type": "vibeflow.node"
});
