# Service 领域基础库

本目录提供历史规划、状态计算、消息处理与合同转换等领域实现。资源及支撑源码由`../plugins/base_lib/`中的SDK声明登记，当前依赖与来源见`../ARCHITECTURE.jsonc`。运行顺序由`../configs/`的Node／Nodeset及连边决定；基础库不承担浏览器监听、任务控制或图外调度。

酒馆IO、队列、回执与资源生命周期位于`../../tavern`。修改时先沿Architecture定位真实调用与实现，遵循本root的AGENTS和开发总览。
