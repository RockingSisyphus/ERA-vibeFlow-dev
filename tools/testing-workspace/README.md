# ERA 三仓测试 workspace

这里是云端重建ERA测试工具链所需的安装元数据，不包含运行数据、密钥或其他项目。清单沿用本机已用依赖锁，去掉GSKO importer；没有修改实际测试项目的源码、版本或业务定义。云端冷安装尚未验收。

将三个私有测试仓库分别clone为同一测试工作区下的`ERA-Test-Pack`、`ST-Test-Harness`、`ST-Response-Lab`目录，再将本目录的package.json、pnpm-workspace.yaml、pnpm-lock.yaml放在该测试工作区根。先按用户约束在该明确工作区内设置短临时路径及pnpm缓存位置，再执行：

```bash
pnpm install --frozen-lockfile
pnpm --dir ST-Response-Lab build
pnpm --dir ST-Test-Harness build:bridge
pnpm --dir ST-Test-Harness build:cli
pnpm --dir ERA-Test-Pack build
```

各仓实际build脚本以其package.json为准。之后按各仓AGENTS运行离线验证；真实酒馆测试仍须另行准备匹配的SillyTavern/Helper、隔离golden、浏览器、bubblewrap及项目配置。不要从本机复制旧sandbox、共享Lab状态或令牌。

仓库：

- RockingSisyphus/ERA-Test-Pack-dev
- RockingSisyphus/ST-Test-Harness-dev
- RockingSisyphus/ST-Response-Lab-dev

ERA产品源码位于RockingSisyphus/ERA-vibeFlow-dev。四个仓库独立提交与推送，不把测试仓库嵌入产品Git或当作无来源副本。
