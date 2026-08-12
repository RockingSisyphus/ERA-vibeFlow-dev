# ERA 冻结基线与差分 oracle 范围

本目录机械导入自源仓库 tag `era-vibeflow-baseline-v1`，对应提交
`11f9c7d9c7881afa264ed27953a69120c0a7d21e`。

`src/ERA变量框架/index.ts` 现在是 ERA VibeFlow 的唯一生产入口：它启动异步 Service
Host、注册同步 Macro adapter、挂载 UI，并在 `pagehide` 时按序清理。

迁移前的 `events/scheduler.ts`、`events/dispatcher.ts`、旧 handlers 及相关纯算法模块只
作为冻结差分 oracle 和故障复现材料保留。Webpack 的 production dependency gate 禁止
这些旧调度模块进入生产依赖图；它们不得重新注册监听器，也不得形成新旧双后端开关。

基线 tag、oracle corpus 和差分测试继续用于验证公开行为；当前实现与发布状态以根项目
Architecture、迁移 TODO、交付报告和最新门禁为准。
