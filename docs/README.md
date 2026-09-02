# v0.2 前期设计基线

本目录是“技术文档精读助手”的产品和技术设计基线。`v0.2` 已完整替换旧的课程学习助手方向，旧方案不在仓库中保留。

## 阅读顺序

1. [RESEARCH.md](./RESEARCH.md)：问题调研、竞品观察与产品机会。
2. [PRD.md](./PRD.md)：用户、范围、业务流程、功能需求与验收标准。
3. [FEASIBILITY.md](./FEASIBILITY.md)：时间、技术、成本、安全与上线可行性。
4. [TECH_STACK.md](./TECH_STACK.md)：技术方案、关键依赖和选型理由。
5. [ARCHITECTURE.md](./ARCHITECTURE.md)：组件边界、数据模型、接口、数据流与故障处理。
6. [PLANNING.md](./PLANNING.md)：后续开发的滚动计划、阶段门槛和需求追踪。
7. [reports/P1_VALIDATION.md](./reports/P1_VALIDATION.md)：真实材料、检索、URL 安全和模型兼容性实测。
8. [reports/P2_HANDOFF.md](./reports/P2_HANDOFF.md) 至 [reports/P5_HANDOFF.md](./reports/P5_HANDOFF.md)：各开发阶段的业务约定、结果与限制。
9. [reports/LOCAL_ACCEPTANCE.md](./reports/LOCAL_ACCEPTANCE.md)：P2–P5 真实浏览器闭环、响应式布局、自动化与安全总体验收。

## 文档优先级

1. 用户在当前对话中的明确决定。
2. `PRD.md` 中的产品行为和范围。
3. `ARCHITECTURE.md` 中的数据与安全边界。
4. `PLANNING.md` 中的当前阶段和验收门槛。
5. 其他实现说明。

如实现需要偏离基线，必须先更新相关设计文档和 `CURRENT.md`，写明原因、代价和替代方案，再进入开发。

## 状态约定

- **已确认**：用户已选择或题目明确要求。
- **默认方案**：已为实现锁定，可在后续评审中修改。
- **外部依赖**：需要用户资料、账号或部署平台才能完成。
- **不纳入首版**：为保证交付而明确排除。
