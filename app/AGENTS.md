# ERA 酒馆应用开发入口

本目录装配ERA局部脚本、公共Facade、同步宏、Vue UI及测试。先读[开发总览](../docs/developer/开发总览.md)、[文档维护指南](../docs/developer/文档维护指南.md)；涉及ERA业务继续读[src/ERA变量框架/AGENTS.md](src/ERA变量框架/AGENTS.md)及更深层规则。

## 职责与接口

- 主Service决定领域规划、变量操作、历史同步与回退；`javascript_project/tavern`的原生Node执行Port、Capability、事件准入、回执和资源生命周期。App保留API发现、公共Facade、宏及展示端口，不重建图外Host或调度器。
- Tavern Helper/SillyTavern接口唯一类型参考是`@types/function/**`、`@types/iframe/**`；实际可用性须由目标酒馆页面验证。优先使用现有高层API，不因底层字段存在就绕过高层接口。
- 公开ERA类型在`@types/iframe/exported.era.d.ts`；跨层DTO与Schema在`../packages/era-contracts`。不要复制接口或另造权威状态。
- 修改前读取对应root的配置和Architecture。执行结构先按协同协议审核；生成物通过正式命令更新。

## 浏览器联调

只有任务明确要求真实酒馆联调时才操作用户页面。先盘点已连接标签页及实际端口，常见酒馆端口8000、静态资源5500、热更新6621；不能仅凭默认端口推定有服务。

检查酒馆助手实时监听是否启用；调试ERA时核对本地脚本与已发布脚本，保留当前启用状态，不擅自改变其他脚本。日常酒馆与独立测试沙箱分别报告。

`pnpm --dir app dev`启动静态资源及webpack监听。实时同步启用后等待编译完成再检查UI与Console，通常无需刷新页面或反复运行生产构建。按任务需要使用现有浏览器工具；工具不可用时明确说明，不能把本地单元测试当真实页面验证。

## 构建与测试

使用Node24、pnpm10及锁文件规定的依赖。常用入口：

- `pnpm --dir app build:workflows`：从同一份源码构建Service、Macro及Tavern两份AOT（async含operation/runtime命名入口）。
- `pnpm --dir app verify`：格式、lint、类型、AOT、质量和单元检查。
- `pnpm --dir app test:integration:tavern`：原生辅助流程执行探针；G3/G4见package脚本。
- `pnpm --dir app build`：需要验收分发物时构建生产bundle。

每次测试前使用long-running-task-monitor；短检查结束直接验收，无活跃批次不留心跳。真实业务综合→细则、定向复跑、分段恢复、审计与finalize统一遵循[回归测试与问题处理](../docs/developer/回归测试与问题处理.md)。不削弱预期、超时或安全检查。

## 模板与专项开发

`src`下带index.html的目录是界面，只有index.ts的目录是脚本；通用模板在`初始模板`和`示例`。界面、局部脚本与MVU专项说明按任务查阅`.agents/skills/`的对应SKILL.md；这些模板资料不改变ERA职责边界。

按用户最新约束，本项目临时资料优先在内存处理；确需落盘只放在当前开发目录的独立临时位置并即时清理，不向外部AI临时区或旁边目录写入本项目材料。当前检查输出放reports，历史资料不作为开发入口。不自动提交、推送、发布，不在用户未授权时打开human-review。
