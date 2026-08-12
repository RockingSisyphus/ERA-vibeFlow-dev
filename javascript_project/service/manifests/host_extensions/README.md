# 服务宿主 Descriptor

`service-host.jsonc` 以稳定 ID `era.tavern.service_host` 登记真实浏览器实现，提供
`vibeflow.port` 与五类 Tavern Capability。descriptor 的依赖列表为空，源码不
导入 node、base_lib、Plugin、Python runtime 或业务 registry。

当前服务 workflow 已用 `status: "implemented"` 选择该扩展。即使进入构建产物，
模块导入和工厂调用仍不会注册 listener 或启动定时器；只有宿主显式调用
`start()` 才进入运行生命周期。
