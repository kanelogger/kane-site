---
locale: "zh-CN"
translationKey: "skill-port"
slug: "skill-port"
translationStatus: "source"
categoryId: "project"
tagIds: ["agent-skills", "cli", "electron", "sqlite", "developer-tools"]

title: "Skill Port"
description: "用一个本地 Hub 集中管理 Agent Skills，并通过 CLI 与 Desktop 将同一份 Skill 按项目或全局启用。"
cardDescription: "一份 Skill，只保存一次。Skill Port 用本地 Hub、显式 enablement 和来源记录管理技能，再通过 CLI 与 Desktop 服务不同项目和 Agent。"
year: 2026
role: "产品设计、架构设计、CLI 与 Desktop 开发"
tags: ["Agent Skills", "CLI", "Electron", "SQLite", "Developer Tools"]
cover: "/assets/projects/skill-port/cover.webp"
featured: true
order: 1
github: "https://github.com/kanelogger/SkillPort"
release: "https://github.com/kanelogger/SkillPort/releases/"
---

## 项目概览

- 问题：Skill 分散在多个 Agent 和项目目录中，重复复制后难以追踪来源、更新和所有权。
- 做法：以 `~/.skill-port` 作为唯一 Hub，明确区分 install/link、project/global；CLI 与 Desktop 复用同一服务层和 SQLite schema。
- 结果：同一份 Skill 可以在多个项目或全局入口启用；移除时只处理 Skill Port 已记录的资源，不触碰外部 linked 源目录和未管理入口。
- 运行要求：CLI 为 Node.js ≥ 22.16；Git 来源命令还需要系统 Git。Desktop 版本资料记录为 `0.1.4`。

之前分享过很多次关于技能管理的想法，核心还是软链接。本来也开发了差不多了，就差 CLI（agent友好）和桌面端这两步，最近把这两步补齐了。

![Skill Port 整体架构：一份 Skill，多处启用](/assets/projects/skill-port/01-overview.webp)

---

## 它是什么

Skill Port 维护一个本地 **Hub**（`~/.skill-port`），所有 Skill 只在这里存一份。然后通过 **enable** 操作，把 Skill 暴露到需要它的项目或全局 Agent 目录。同一个 Hub 可以服务多个项目，CLI 和 Desktop 共享同一套数据和 schema。

- **Desktop**（Electron 应用）给人用：选目录、点按钮、看状态。
- **CLI** 给 Agent 用：装好以后，你可以直接让 Agent 替你管理。CLI 安装时会自动向 `~/.agents/skills/skill-port` 注册一个内置管理 Skill，兼容的 Agent 在新会话中就能发现 `sklp`，无需你手动修改 `AGENTS.md`。

### 实际效果

![Desktop 主界面](/assets/projects/skill-port/06-desktop.webp)

![CLI 安装过程](/assets/projects/skill-port/07-cli-install.webp)

![CLI 安装技能后的桌面端效果](/assets/projects/skill-port/08-cli-result.webp)

---

## 设计思路

### 核心模型：Hub 是唯一的真相来源

Skill Port 有三个关键概念：

| 概念 | 是什么 | 示例 |
|---|---|---|
| **Hub** | 所有 Skill 的物理存储（`~/.skill-port`），基于 SQLite 维护状态 | 一份 `baoyu-translate` 只存在于 Hub |
| **Enablement** | 将 Skill 暴露到目标的动作，项目级或全局 | `sklp enable baoyu-translate --global` |
| **Source** | Skill 的来源：Git 仓库、本地目录复制（install）、本地目录链接（link） | `sklp install https://github.com/owner/skill.git` |

![Hub 作为唯一真相来源的完整分发链](/assets/projects/skill-port/02-source-of-truth.webp)

Hub 不扫描文件系统来发现 Skill。每个 Skill 必须显式地 install 或 link 到 Hub，再显式地 enable 到目标。这个设计来自一个明确的选择：**显式优于隐式**。Agent Skill 目录是共享资源，如果你允许自动发现，就无法保证每个入口都有明确的所有者和可追溯的来源。

### install vs link：两个不同的所有权模型

当你想把一个本地 Skill 加入 Hub 时，有两种模式：

- **`sklp install ~/skills/my-skill`**：把 Skill 目录**复制**到 Hub 内。Hub 成为这份 Skill 的唯一管理者。适合不需要再改动的 Skill，或者来自 Git 仓库的 Skill。
- **`sklp link ~/skills/my-skill`**：在 Hub 中创建一个指向原始目录的**符号链接**。你继续在原目录维护 Skill，Hub 只负责分发。适合你正在开发的 Skill，或者你希望保留外部所有权的 Skill。

这个区分直接关系到卸载行为：`sklp uninstall` 会清空 Hub 内的复制 Skill，但**永远不会删除** Hub 外的 linked 源目录。

![install 与 link 的所有权模型对比](/assets/projects/skill-port/03-install-vs-link.webp)

### project vs global：两种分发范围

- **项目级**（`sklp enable my-skill`）：Skill 启用到 `<project>/.agents/skills/`。只对该项目生效。
- **全局**（`sklp enable my-skill --global`）：Skill 启用到 `~/.agents/skills/`。所有项目都能用。

两者的启用入口由 Hub 的 enablement 记录追踪。删除 Skill 时（`sklp remove --force`），Skill Port 只移除自己管理的入口；`~/.agents/skills/` 中非 Skill Port 创建的文件和链接不会被触碰。

![项目级与全局分发范围对比](/assets/projects/skill-port/04-project-vs-global.webp)

### Desktop 如何复用 CLI 核心

Desktop 不是 CLI 的 GUI 外壳——它不解析 stdout。Desktop 使用 Electron 43，渲染进程完全沙箱化（无 Node、无文件系统、无原始 IPC），通过受限 preload 将请求发到主进程，再由独立的 utility 进程调用 `DesktopSkillPort` 应用层 facade。所有持久化行为最终走与 CLI 相同的 `SkillPort` 服务类，共享同一 Hub 和 SQLite schema。

这意味着你可以在 CLI 里装一个 Skill，用 Desktop 启用它，反过来也完全兼容。

![Desktop 与 CLI 共享 SkillPort 服务和 SQLite 状态](/assets/projects/skill-port/05-shared-core.webp)

---

## 快速开始

环境要求：Node.js ≥ 22.16。从 Git 仓库安装 Skill 时还需要系统 Git。

### 让 Agent 帮你装

把下面这句话发给能够执行终端命令的编码 Agent：

> 参考 https://github.com/kanelogger/SkillPort 帮我全局安装 Skill Port CLI。先检查 Node.js 是否满足版本要求，再执行 `sklp --version` 和 `sklp agent setup` 验证安装；遇到权限或 PATH 问题时先报告，不要自行绕过。

### 桌面端

安装 [Skill Port Desktop 0.1.4](https://github.com/kanelogger/SkillPort/releases/)。

![添加 Skill 步骤 1](/assets/projects/skill-port/09-add-skill.webp)

![添加 Skill 步骤 2](/assets/projects/skill-port/10-enable-skill.webp)
