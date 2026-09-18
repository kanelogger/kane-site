# Agent 环境索引

这是按需入口。项目契约在 [project.yml](project.yml)，命令实现和 pnpm 版本在 [package.json](package.json)，Node 精确版本在 [.node-version](.node-version)。`project.yml` 使用 YAML 1.2 的 JSON 子集，便于安装依赖前用 Node 内置解析器诊断；修改时保持 JSON 语法，不添加 YAML 注释。

| 任务 | 加载资料 |
| --- | --- |
| 新 checkout、安装、运行验证 | [命令与验收](docs/agent-environment/commands.md) |
| 启停 dev / preview | [服务](docs/agent-environment/services.md) |
| Skill、浏览器、外部连接 | [能力](docs/agent-environment/capabilities.md) |
| 沙箱、网络、私有文件 | [权限与文件系统](docs/agent-environment/network-filesystem.md) |
| CI、生产发布与环境差异 | [CI 与发布](docs/agent-environment/ci-parity.md) |
| 中断恢复与交付 | [任务入口](tasks/README.md) |

执行 `pnpm agent:doctor` 获得本次会话的能力探测；机器可读输出用 `node scripts/agent-doctor.mjs --json`。报告包含时间、运行时、各项状态、探测来源与修复动作，不自动安装、修改权限或保存报告。需要证据时存入被忽略的 `.agent-local/`，只把脱敏结论写入任务文件。

环境事实的负责人为仓库维护者。新会话、运行时/依赖/CI/权限变化后重新探测；历史通过不能证明当前权限。`healthy` 只表示该探测范围通过，例如能绑定临时端口不代表浏览器、网络或生产访问可用。浏览器和外部连接未实际使用前均为 `unknown`。

普通开发仅需 Git、Node、pnpm 和依赖，不需要本地私有资料、全局 Skill、MCP、数据库或生产凭据。初次安装需要访问包仓库；安装完毕后的本地验证使用磁盘和 loopback。发布前独立确认实际平台配置与授权。
