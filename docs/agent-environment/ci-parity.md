# 本地、CI 与发布

| 环境 | 配置与状态 | 验收 |
| --- | --- | --- |
| 本地 | `.node-version`、`package.json`、lockfile；实际 OS/架构由 doctor 报告 | frozen install → doctor → verify |
| CI | `.github/workflows/verify.yml`，Ubuntu runner；使用同一 Node 文件和 pnpm 声明 | frozen install → doctor → verify；真实结果以 Actions 日志为准 |
| 发布 | Vercel 项目设置不在此 checkout 中；实际 Node、权限、部署来源须在发布时确认 | 对应版本的本地构建 → 部署检查 → 浏览器验收 |

CI 在 PR、main 推送和手动触发时运行，只有读取仓库权限，不带生产密钥、不执行部署。使用 `pull_request`，不以具有写权限的 `pull_request_target` 运行外部代码。检查失败退出，不把缓存当验证证据。

CI 配置存在不等于已在线运行。启用分支保护或 required checks 属于远程仓库设置，需要发布到远程后由有权限的维护者配置。Vercel 对 main 的现有自动部署不会因为新增 CI 就自动等待检查；要强制发布门禁，需另行配置平台策略。不得声称本次环境文件已经阻止生产部署。

本地 macOS 与 CI Linux 的原生依赖不同，分别按同一 lockfile 安装，不能复制本地 `node_modules` 到 CI。运行时、锁文件、runner 或平台构建配置变化后重新验证；Node 更新同时修改 `.node-version` 和 `package.json#engines.node`，契约检查会拒绝两者不一致。

`verify:deployment URL` 逐字节比对给定地址与本地 `dist/`。平台若注入内容、使用不同源码/依赖或构建环境，可能导致差异；查明原因后处理，不能忽略失败。该命令按生产索引策略拒绝首页 `X-Robots-Tag: noindex`，因此启用 noindex 或访问保护的预览部署可能不通过。预览验收与生产索引策略冲突时如实报告，不能关闭正常的预览保护来凑通过。

参考：[setup-node](https://github.com/actions/setup-node)、[pnpm/action-setup](https://github.com/pnpm/action-setup)。
