# Phase 2: Keepalive Probe - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-04
**Phase:** 2-Keepalive Probe
**Areas discussed:** 测试覆盖范围, probe-report 输出格式, Docker probe profile 行为, 提交策略

---

## 测试覆盖范围

| Option | Description | Selected |
|--------|-------------|----------|
| 全部通过即可提交 | npm test 全绿就算完成，不需要额外集成测试 | |
| 通过 + 补充缺失场景 | 先跑测试，发现缺口再补充 | ✓ |
| 只要代码逻辑正确 | 测试是辅助，重点是功能可运行 | |

**User's choice:** 通过 + 补充缺失场景
**Notes:** 实际运行后发现所有 18 个 probe 测试已全部通过，无需补充。5 个失败测试均属 Phase 1 已有问题（validate、web server、health-check），不在 Phase 2 范围内。

---

## probe-report 输出格式

| Option | Description | Selected |
|--------|-------------|----------|
| 保持现状（逐行文本） | 保持现有的 console.log 逐行输出 | ✓ |
| 格式化表格/分隔线 | 用对齐表格或分隔线让报告更易读 | |
| 增加 --json 选项 | 支持机器可读格式，方便脚本处理 | |

**User's choice:** 保持现状（逐行文本）
**Notes:** 当前输出已满足需求，无需改动。

---

## Docker Probe Profile 行为

| Option | Description | Selected |
|--------|-------------|----------|
| 保持现状（依赖环境变量） | compose 不传参数，靠 ATV_DEVICE_IP/PORT 和代码默认值 | ✓ |
| compose 里写明参数 | 在 command 里显式传 --interval-ms 和 --duration-ms | |
| 增加 .env 可配置变量 | 暴露 PROBE_INTERVAL_MS / PROBE_DURATION_MS 供用户覆盖 | |

**User's choice:** 保持现状（依赖环境变量）
**Notes:** 默认值（6h/30s）已在代码常量中定义，compose 无需改动。

---

## 提交策略

| Option | Description | Selected |
|--------|-------------|----------|
| 一次性提交所有文件 | 所有 probe 文件打包成一个 commit | ✓ |
| 按关注点分拆提交 | 分 3 个 commit：核心服务 → CLI 命令 → Docker/配置 | |
| 先提交代码，再提交测试 | 实现代码一个 commit，测试文件一个 commit | |

**User's choice:** 一次性提交所有文件
**Notes:** 约 10 个未提交文件，统一打包提交。

---

## Claude's Discretion

无 — 所有决策均由用户明确选择。

## Deferred Ideas

- Multi-run 对比分析（v2 需求）
- probe 结果的 Web UI（v2 需求）
- probe-report 的 `--json` 输出标志
