# Service 领域节点

本目录是已实施的TypeScript Node源码。节点由`../plugins/nodes/`中的固定SDK声明登记，实际流程在`../configs/`；从`../ARCHITECTURE.jsonc`沿source定位调用和具名导出。

节点负责领域规划、历史与变量操作，通过Capability请求原生酒馆辅助workflow执行IO。不得直接访问DOM或Tavern全局API。执行结构变更按协同协议先审核，完成后更新Architecture并运行适用检查。
