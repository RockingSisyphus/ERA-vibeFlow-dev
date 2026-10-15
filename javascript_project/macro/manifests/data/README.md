# 合同一致性检查用 Data Schema

本目录JSONC由`packages/era-contracts/scripts/check-schema-sync.mjs`读取，与contracts包的canonical Schema核对结构。它们是实际检查输入，不能按“旧manifests目录”整体删除。

运行时资源登记以本root的`plugins/`固定SDK声明为准，正式架构由`ARCHITECTURE.jsonc`生成。修改数据合同时同步检查canonical Schema与SDK声明；本目录不恢复项目级descriptors注册。
