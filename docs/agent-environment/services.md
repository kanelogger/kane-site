# 本地服务

本站无数据库、队列或后台 API。日常使用 Astro dev，构建验收使用 Astro preview。

| 服务 | 状态 | 启动 | 停止 |
| --- | --- | --- | --- |
| 开发 | `pnpm astro dev status` | `pnpm dev --background --host 127.0.0.1` | `pnpm astro dev stop` |
| 预览 | `pnpm astro preview status` | 先 `pnpm build`，再 `pnpm preview --background --host 127.0.0.1` | `pnpm astro preview stop` |

启动前检查已有实例，不复用或停止不明归属的服务。地址和实际端口以启动输出为准；端口冲突时通过 `--port` 显式选择可用端口，不杀掉占用者。不要同时让两个任务在同一 checkout 构建或覆盖 `dist/`。

健康检查：读取 `pnpm astro dev logs` / `pnpm astro preview logs`，请求启动输出中的根 URL，确认响应成功；再按本次任务检查页面。仅 HTTP 200 不能证明交互和布局通过。浏览器工具由当前会话提供，缺失时报告未验收。

前台运行可省略 `--background`，用对应终端的 Ctrl-C 停止。退出前清理本任务创建的服务，用 `status` 确认已停止；不要清理其他任务的服务。自检的临时端口会立即关闭，不留下预览服务。

启动、状态查询和停止应使用相同的进程权限。受限沙箱可能无法探测在沙箱外启动的进程，导致 `status` 误报无服务并清理锁文件。保留本次启动输出中的 PID 与地址；若状态和 HTTP 响应矛盾，先在原权限范围核实。锁记录已丢失时，只有核对 PID 的命令行与本任务 checkout 完全一致后，才可对该 PID 发送 SIGTERM 并确认退出，禁止按端口或名称批量终止进程。
