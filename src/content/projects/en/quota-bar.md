---
locale: "en"
translationKey: "quota-bar"
slug: "quota-bar"
translationStatus: "reviewed"
categoryId: "project"
tagIds: ["swift", "macos", "swiftui", "appkit", "developer-tools"]

title: "QuotaBar"
description: "A native macOS menu-bar utility that brings Codex, Kimi Code, DeepSeek, and OpenCode Go quota or account status into one place."
cardDescription: "A macOS menu-bar utility for several AI coding services. It surfaces the tightest available metric and lets one provider fail without blocking the others."
year: 2026
role: "Product design, Swift architecture and development, multi-platform probes, testing, and release engineering"
tags: ["Swift", "macOS", "SwiftUI", "AppKit", "Developer Tools"]
cover: "/assets/projects/quota-bar/cover.webp"
featured: true
order: 2
github: "https://github.com/kanelogger/QuotaBar"
release: "https://github.com/kanelogger/QuotaBar/releases"
---

## Project overview

- **Problem:** Codex, Kimi Code, DeepSeek, and OpenCode Go expose quota or account status in separate places. It is hard to see which resource is currently most constrained.
- **Approach:** `QuotaCore` contains shared models, a parallel coordinator, and four provider probes. The `QuotaBar` application layer owns the SwiftUI/AppKit menu bar, Keychain, browser-cookie import, settings, and localization.
- **Result:** The menu bar shows the tightest available metric. A provider failure does not block other providers; the last successful value is retained and marked stale.
- **Current capabilities:** Codex weekly quota; Kimi Code five-hour and weekly quotas; DeepSeek CNY/USD balance and account status. OpenCode Go links to the official console and does not claim to query usage inside the app.
- **Testing:** `QuotaCoreTests` and `QuotaBarTests` cover window boundaries, parser fixtures, aggregation, stale data, refresh merging, and progressive card updates.
- **Privacy:** DeepSeek API keys and manually entered Kimi tokens are stored in the system Keychain. The project does not record tokens, cookies, authorization headers, or raw private responses.
- **Known limit:** Kimi monthly quota has no stable machine interface verified against a real account. The app shows “currently unavailable” and links to the subscription page.
- **Release boundary:** GitHub currently provides a `v1.0.0-unsigned.1` pre-release DMG and ZIP. It is unsigned and not notarized; the site must not describe it as a formal or frictionless installation.

QuotaBar targets macOS 14+ and supports:

- **OpenCode Go:** use the official console to view subscription usage; no local CLI is required.
- **Kimi Code:** five-hour and weekly quota; monthly quota currently links to the subscription page.
- **Codex:** remaining weekly quota.
- **DeepSeek:** CNY/USD balance and account availability.

The menu bar normalizes available metrics and displays the tightest one. DeepSeek uses configurable thresholds, defaulting to CNY ¥10 and USD $2. A single provider failure never blocks the others; its last successful value remains visible as stale data.

## Interface preview

![Main window](/assets/projects/quota-bar/01-main-window.webp)

![Settings](/assets/projects/quota-bar/02-settings.webp)

## Engineering structure

- `Sources/QuotaCore`: shared models, parallel coordinator, four provider probes, process abstraction, and network abstraction.
- `Sources/QuotaBar`: SwiftUI/AppKit menu bar, Keychain, browser-cookie import, settings, and localization.
- `Tests/QuotaCoreTests`: window boundaries, parser fixtures, aggregation, and stale-data tests.
- `Tests/QuotaBarTests`: refresh merging and progressive card updates.
- `project.yml`: XcodeGen project definition.
- `Package.swift`: standalone QuotaCore test runner.

## Build locally

Requirements: full Xcode, XcodeGen, and macOS 14+.

```bash
xcodegen generate
xcodebuild -project QuotaBar.xcodeproj -scheme QuotaBar -destination 'platform=macOS' test
```

Core tests can also run independently:

```bash
swift test
```

## Kimi monthly quota boundary

Kimi Code five-hour and weekly quotas use `BillingService/GetUsages`. The member-shared monthly quota is exposed on the subscription page; there is currently no stable machine interface verified against a real account. **v1 therefore displays “currently unavailable” and provides the subscription-page entry point.** The code keeps a `KimiMonthlyUsageProviding` seam for a future implementation; it should be enabled only after a redacted read-only response and fixture contract tests exist.

An account without a Kimi Code subscription currently returns HTTP 200 with an empty JSON object. The app marks five-hour, weekly, and monthly quota as unavailable and reports subscription status; it does not misclassify this as an API format change.

**The app does not record tokens, cookies, authorization headers, or raw private responses.**

Source: [project README](https://github.com/kanelogger/QuotaBar/blob/main/README.md). Release status was checked on 2026-09-11.
