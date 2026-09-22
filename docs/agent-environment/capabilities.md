# 能力与恢复

| 能力 | 来源与检查 | 缺失时的动作 |
| --- | --- | --- |
| Node / pnpm | `.node-version`、`package.json`，`agent:doctor` 实时检查 | 安装匹配版本后重跑 |
| 构建依赖 | lockfile、`node_modules`；自检检查直接依赖是否存在 | `pnpm install --frozen-lockfile`，再完整验证 |
| 本地端口 | 自检绑定 `127.0.0.1:0` 后关闭 | 在允许 loopback 的环境执行，或按当前工具权限机制获得许可 |
| 内容导入 | [公开操作手册](../content-import.md)、`pnpm verify:content`；可选本地 `kane-site-content-import` Skill | 直接按公开手册执行，无需安装私有 Skill |
| 浏览器验收 | 当前会话实际暴露的浏览器工具 | 若无法操作，记录 UI 验收未执行，不伪造截图或通过结论 |
| 发布连接与凭据 | 当前平台配置及当前会话授权 | 仅在发布任务中检查，不为本地开发索取生产凭据 |

自检用 `healthy`、`unavailable`、`blocked-by-policy` 表达必需能力的实际探测结果；可选 Skill 文件存在仅标为 `installed`，浏览器和生产能力标为 `unknown`。文件存在不等于已加载、有权限或运行成功。

`.agents/` 保持私有，不整目录纳入 Git、不让新 checkout 依赖它。公开手册、Schema 和内容校验器是内容导入的可移植事实源；本地 Skill 只负责路由到这些入口和保留隐私、授权边界。需要在另一台机器恢复个人 Skill 时，使用已经确认的 Skill 来源和管理工具；仓库不猜测下载地址、不自动安装全局插件。

这里只保存来源和探测方式，不保存账号、令牌、会话历史或永久的 healthy 快照。权限来自当前运行环境，`project.yml` 的声明不会扩大实际权限。
