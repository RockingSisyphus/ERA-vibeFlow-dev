# VibeFlow 开发入口

本项目使用两个 JavaScript AOT root：异步服务位于 `javascript_project/service`，同步宏位于 `javascript_project/macro`。先阅读所选 root 的 `vibeflow_project.jsonc` 和已登记的 `ARCHITECTURE.jsonc`，沿 Architecture 的 source 定位并修改真实 Config、Nodeset、descriptor 或 Node source；生成文档只通过 VibeFlow 命令更新。

按任务阅读规范：

- 修改 workflow、Config 或 edge：[`kernel/docs/user/workflow-and-config.md`](kernel/docs/user/workflow-and-config.md)
- 查阅 Python Target 接口（本项目当前不使用）：[`kernel/docs/user/python-development.md`](kernel/docs/user/python-development.md)
- 开发 JavaScript/TypeScript Node：[`kernel/docs/user/javascript-development.md`](kernel/docs/user/javascript-development.md)
- 开发 Nodeset 或 Loop：[`kernel/docs/user/nodesets-and-loops.md`](kernel/docs/user/nodesets-and-loops.md)
- 开发 Plugin、Capability 或 Host Extension：[`kernel/docs/user/plugins-and-integrations.md`](kernel/docs/user/plugins-and-integrations.md)
- 运行检查或解释结果：[`kernel/docs/user/commands-and-results.md`](kernel/docs/user/commands-and-results.md)

完成修改后更新 Architecture，并执行适用的 validate、quality、build 和工作流执行探针。按结果中的实际证据报告完成状态。

# Collaborative profile

遵循[`人机协同开发协议`](kernel/docs/user/profiles/collaborative.md)：维护四类变更清单，以 planned 内容生成正式审核图，等待人类明确批准后实施获批变化。机器检查与人工批准分别报告。
