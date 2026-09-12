---
locale: "zh-CN"
translationKey: "quota-bar"
slug: "quota-bar"
translationStatus: "source"
categoryId: "project"
tagIds: ["swift", "macos", "swiftui", "appkit", "developer-tools"]

title: "QuotaBar"
description: "一个 macOS 原生菜单栏工具，集中展示 Codex、Kimi Code、DeepSeek 与 OpenCode Go 的额度或账户状态。"
cardDescription: "把多个 AI 编程服务的额度状态收进一个 macOS 菜单栏。自动显示最紧张指标，单个平台失败不会阻断其他平台。"
year: 2026
role: "产品设计、Swift 架构与开发、多平台探针、测试与发布工程"
tags: ["Swift", "macOS", "SwiftUI", "AppKit", "Developer Tools"]
cover: "/assets/projects/quota-bar/cover.webp"
featured: true
order: 2
github: "https://github.com/kanelogger/QuotaBar"
release: "https://github.com/kanelogger/QuotaBar/releases"
---

## 项目概览

- 问题：Codex、Kimi Code、DeepSeek 与 OpenCode Go 的额度或账户状态分散在不同入口，使用者难以快速判断当前最紧张的资源。
- 做法：把统一模型、并行协调器和四个平台探针放入 `QuotaCore`，把 SwiftUI/AppKit 菜单栏、Keychain、浏览器 Cookie 导入、设置和本地化放入 `QuotaBar` 应用层。
- 结果：菜单栏自动显示所有可用指标中最紧张的一项；单个平台失败不影响其他平台，最近一次成功值会保留并标记为旧数据。
- 当前能力：Codex 周额度、Kimi Code 5 小时与周额度、DeepSeek CNY/USD 余额及账户状态；OpenCode Go 提供官方控制台入口，不宣称在应用内直接查询用量。
- 测试：仓库包含 `QuotaCoreTests` 与 `QuotaBarTests`，覆盖窗口边界、解析 fixture、聚合、旧数据、刷新合并和卡片渐进更新。
- 隐私边界：DeepSeek API Key 与手动 Kimi Token 保存在系统 Keychain；项目声明不记录 Token、Cookie、Authorization Header 或原始私密响应。
- 已知限制：Kimi 月额度没有经过真实账号验证的稳定机器接口，当前显示“暂不可查询”并提供订阅页入口。
- 发布边界：GitHub 当前提供 `v1.0.0-unsigned.1` 预发布 DMG 与 ZIP；该版本未签名、未经过 Apple 公证，网站不得表述为正式版或无障碍安装版本。

macOS 14+ 原生菜单栏额度查询工具，集中展示：

* **OpenCode Go**：不需要本机 CLI；在官方控制台查看订阅用量。
* **Kimi Code**：5 小时、周额度；月额度当前显示订阅页入口。
* **Codex**：周剩余额度。
* **DeepSeek**：CNY/USD 余额和账户可用状态。

**菜单栏自动显示所有可用指标中最紧张的一项。** DeepSeek 使用可配置阈值归一化，默认 CNY ¥10、USD $2。**单个平台失败不会阻断其他平台**，最近一次成功值会保留并标记为旧数据。

## 界面预览

主界面：

![主界面](/assets/projects/quota-bar/01-main-window.webp)

设置界面：

![设置界面](/assets/projects/quota-bar/02-settings.webp)

## 工程结构

* `Sources/QuotaCore`：统一模型、并行协调器、四个平台探针、进程和网络抽象。
* `Sources/QuotaBar`：SwiftUI/AppKit 菜单栏、Keychain、浏览器 Cookie 导入、设置和本地化。
* `Tests/QuotaCoreTests`：窗口边界、解析 fixture、聚合和过期数据测试。
* `Tests/QuotaBarTests`：刷新合并和卡片渐进更新测试。
* `project.yml`：XcodeGen 工程定义。
* `Package.swift`：独立运行 QuotaCore 单元测试。

## 本地构建

要求：完整 Xcode、XcodeGen、macOS 14+。

```bash
xcodegen generate
xcodebuild -project QuotaBar.xcodeproj -scheme QuotaBar -destination 'platform=macOS' test
```

也可以只测试核心模块：

```bash
swift test
```

## Kimi 月额度边界

Kimi Code 的 5 小时和周额度使用 `BillingService/GetUsages`。会员共享月额度位于订阅页，当前没有经过真实账号验证的稳定机器接口，因此 **v1 明确显示"暂不可查询"并提供订阅页入口**。代码通过 `KimiMonthlyUsageProviding` 保留独立实现接缝；**只有捕获并脱敏真实只读响应、补齐 fixture 契约测试后才应启用**。

未订阅 Kimi Code 的账号当前返回 HTTP 200 与空 JSON 对象；应用会将 5 小时、周和月额度标记为不可用，并提示订阅状态，**不把它误报为接口格式变化**。

**应用不记录 Token、Cookie、Authorization Header 或原始私密响应。**

内容依据：[项目 README](https://github.com/kanelogger/QuotaBar/blob/main/README.md)，发布状态以 2026-09-11 核对结果为准。
