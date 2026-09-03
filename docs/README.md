# Lumen 项目文档导读

本目录是「技术文档精读助手（Lumen）」的产品与技术设计基线，以及交付验收证据。`v0.2` 已完整替换旧的课程学习助手方向，旧方案不在仓库中保留。

阅读入口与各文档的关系，可先从产品侧理解：`PRD.md` 定义要做什么，`ARCHITECTURE.md` 定义系统如何实现，`PLANNING.md` 定义如何滚动交付，`reports/` 里记录验收结果，`archive/` 里保存开发过程文档。

## 1. 阅读顺序（设计基线）

面向需要理解产品设计、技术实现和验收结论的读者：

1. [PRD.md](./PRD.md)：用户、范围、业务流程、功能需求与验收标准。
2. [ARCHITECTURE.md](./ARCHITECTURE.md)：系统边界、数据模型、接口、数据流与故障处理。
3. [TECH_STACK.md](./TECH_STACK.md)：技术方案、关键依赖和选型理由。
4. [PLANNING.md](./PLANNING.md)：后续开发的滚动计划、阶段门槛和需求追踪。
5. [RESEARCH.md](./RESEARCH.md)：问题调研、竞品观察与产品机会。
6. [FEASIBILITY.md](./FEASIBILITY.md)：时间、技术、成本、安全与上线可行性。
7. [DECISIONS.md](./DECISIONS.md)：P2–P5 开发中的默认决策与依据。
8. [OPEN_ISSUES.md](./OPEN_ISSUES.md)：待解决和待决策的技术、模型与部署事项。
9. [UX_ISSUES.md](./UX_ISSUES.md)：用户试用中发现的流程、交互、语言与视觉问题。

## 2. 验收与审计（当前有效）

以下文档记录了已完成的验收和审计结论，是当前状态最有参考价值的证据：

| 文档 | 内容 | 结论 |
| --- | --- | --- |
| [reports/LOCAL_ACCEPTANCE.md](./reports/LOCAL_ACCEPTANCE.md) | P2–P5 真实浏览器主流程、响应式布局、自动化与安全总体验收 | 通过；本地闭环完成 |
| [reports/ROUTING_REVIEW.md](./reports/ROUTING_REVIEW.md) | 门面首页、业务路径与阶段二级路由的职责边界 | 维持 `/>/home>/profile>/reading>/reading/stage` |
| [reports/LOCAL_UX_PERSISTENCE_AUDIT.md](./reports/LOCAL_UX_PERSISTENCE_AUDIT.md) | 本地视觉巡检：交互与会话恢复 | 进程内可恢复，但不证明公网可靠；Redis 不解决 UI 状态 |

## 3. 开发过程文档（已归档）

以下文档保留了开发各阶段的实施设计、阶段交接与早期评估，属于过程性材料，已移入 [archive/](./archive/)。它们不再作为当前设计基线，但可用于追溯决策过程、复现实验或理解阶段演进。

- [archive/P1_VALIDATION.md](./archive/P1_VALIDATION.md)：P1 技术可行性验证（真实材料、检索、URL 安全、Qwen 兼容性）。
- [archive/P2_DESIGN.md](./archive/P2_DESIGN.md) / [archive/P2_HANDOFF.md](./archive/P2_HANDOFF.md)：应用基础与来源导入。
- [archive/P3_DESIGN.md](./archive/P3_DESIGN.md) / [archive/P3_HANDOFF.md](./archive/P3_HANDOFF.md)：文档地图、路线与检索。
- [archive/P4_DESIGN.md](./archive/P4_DESIGN.md) / [archive/P4_HANDOFF.md](./archive/P4_HANDOFF.md)：分阶段精读工作流。
- [archive/P5_DESIGN.md](./archive/P5_DESIGN.md) / [archive/P5_HANDOFF.md](./archive/P5_HANDOFF.md)：确认式笔记与导出。
- [archive/UX_AND_AI_TUTOR_REVIEW.md](./archive/UX_AND_AI_TUTOR_REVIEW.md)：首轮体验审查、Markdown 渲染、侧边抽屉与 AI 助教评估。
- [archive/WORKSPACE_SESSION_AUTH_REVIEW.md](./archive/WORKSPACE_SESSION_AUTH_REVIEW.md)：Codex 式工作区、会话、历史、数据库与登录边界评估。
- [archive/REDIS_SESSION_STORE_FEASIBILITY.md](./archive/REDIS_SESSION_STORE_FEASIBILITY.md)：Redis 临时会话存储可行性与执行指导（P6.0 前置）。

> 说明：`docs/archive/` 只用于存放开发过程文档，不作为当前产品与设计基线。任何后续阶段若复用其中的结论，请先在 `DECISIONS.md` 或对应基线文档中登记。

## 4. 文档优先级

1. 用户在当前对话中的明确决定。
2. `PRD.md` 中的产品行为和范围。
3. `ARCHITECTURE.md` 中的数据与安全边界。
4. `PLANNING.md` 中的当前阶段和验收门槛。
5. 其他实现说明。

如实现需要偏离基线，必须先更新相关设计文档和 `CURRENT.md`，写明原因、代价和替代方案，再进入开发。

## 5. 状态约定

- **已确认**：用户已选择或题目明确要求。
- **默认方案**：已为实现锁定，可在后续评审中修改。
- **外部依赖**：需要用户资料、账号或部署平台才能完成。
- **不纳入首版**：为保证交付而明确排除。
