# 技术文档精读助手

公司 AI 产品应用开发面试作业的交付仓库。

## 产品方向

本项目面向需要理解陌生 RFC、协议规范、架构设计和原理文档的软件开发者。用户导入一份文件或公开 URL，设置阅读目标和熟悉程度，系统生成文档地图与分阶段精读路线；每个阶段提供原文引用和检查问题，只有用户编辑并确认的内容才会进入最终 Markdown 笔记。

首版不提供无文档通用聊天，不主动联网搜索，也不建设多文档知识库、长期记忆或通用 Agent 平台。

## 当前状态

`v0.2` 的 P1–P5 和本地浏览器验收已完成：产品支持来源导入、阅读画像、文档地图、阶段精读、可信引用、确认式笔记和 Markdown 导出。P6 公网部署与 P7 面试材料尚未开始。

## 文档入口

- `AGENT.md`：工程协作、安全和阶段交接约定。
- `CURRENT.md`：当前事实、外部依赖和下一步。
- `AI 产品应用开发面试作业.pdf`：公司提供的原始题目。
- `docs/RESEARCH.md`：需求与竞品调研。
- `docs/PRD.md`：产品需求和验收标准。
- `docs/FEASIBILITY.md`：时间、技术、成本与风险分析。
- `docs/TECH_STACK.md`：技术选型及理由。
- `docs/ARCHITECTURE.md`：系统边界、接口和数据流。
- `docs/PLANNING.md`：P0–P7 滚动开发计划和需求追踪。
- `docs/reports/P1_VALIDATION.md`：真实材料、检索、URL 安全与 Qwen 兼容性结果。
- `docs/DECISIONS.md`：P2–P5 开发中的默认决策与依据。
- `docs/OPEN_ISSUES.md`：完成后的待解决和待决策事项。
- `docs/UX_ISSUES.md`：用户试用中发现的流程、交互、语言和视觉体验问题，独立于技术/产品开放问题。
- `docs/reports/UX_AND_AI_TUTOR_REVIEW.md`：首轮体验审查、Markdown 渲染、侧边对话抽屉和 AI 助教评估报告。
- `docs/reports/LOCAL_ACCEPTANCE.md`：真实 MyBatis 浏览器主流程、移动端、自动化与安全验收证据。

## 本地运行

要求 Node.js 22+。模型配置保存在不会提交的 `.env.local`：

```bash
npm install
npm run config:import -- /absolute/path/to/api-config.csv
npm run dev
```

浏览器访问 [http://localhost:3000](http://localhost:3000)。本地主 Demo 使用获准的 MyBatis PDF 文件上传；会话最后活动 2 小时后清理，开发服务器重启后允许丢失。

建议验收路径：导入 MyBatis 规范 → 选择阅读画像 → 生成路线 → 开始首阶段 → 打开来源 → 结束阶段 → 生成并编辑草稿 → 接受 → 导出笔记。当前本地实测为 57 页、80 个来源块、4 阶段路线；刷新后会恢复 TTL 内会话并定位到下一个待开始阶段。

## 验证

```bash
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

最新完整结果：16 个测试文件、59 项测试通过，生产构建通过，依赖审计为 0 个已知漏洞；390 px 移动视口无横向溢出。详见 `docs/reports/LOCAL_ACCEPTANCE.md`。

## P1 实验复现

P1 是无业务 UI 的风险验证原型。真实资料保持在仓库外，API 配置只写入被 Git 忽略的 `.env.local`。

```bash
npm install
npm run config:import -- /absolute/path/to/api-config.csv
npm run typecheck
npm test
npm run p1
```

可使用 `npm run p1:parsing`、`npm run p1:retrieval` 或 `npm run p1:model` 单独运行对应实验。聚合结果写入 `tmp/`，不会提交到 Git。

## 开发纪律

后续阶段以 `docs/PLANNING.md` 为唯一进度入口。每个阶段必须完成对应验收与业务交接；任何会改变范围、数据、安全、成本或接口的决定，先更新设计基线，再修改实现。

公网部署、Docker、生产限流和面试演示材料属于 P6/P7，不在当前本地交付范围。
