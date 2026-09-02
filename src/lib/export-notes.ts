import type { Citation, SessionState } from "./types";
import { AppError } from "./errors";
import { sanitizeMarkdown } from "./note-service";

export interface ExportedNotes {
  filename: string;
  content: string;
}

function labelGoal(value: string): string {
  return { overview: "建立全局认知", mechanism: "深入理解机制", implementation: "准备实现评审" }[value] ?? value;
}

function labelFamiliarity(value: string): string {
  return { new: "初次接触", basic: "了解基础", experienced: "已有实践" }[value] ?? value;
}

export function exportNotes(session: SessionState): ExportedNotes {
  if (!session.source || !session.plan || !session.profile) {
    throw new AppError("PLAN_REQUIRED", "当前会话没有可导出的阅读成果", 409);
  }
  const accepted = session.notes.filter((note) => note.status === "accepted");
  if (!accepted.length) throw new AppError("NO_ACCEPTED_NOTES", "至少接受一份阶段笔记后才能导出", 409);
  const acceptedStageIds = new Set(accepted.map((note) => note.stageId));
  const citations = new Map<string, Citation>();
  for (const stage of session.plan.stages) {
    if (!acceptedStageIds.has(stage.id)) continue;
    for (const message of stage.messages) {
      for (const citation of message.citations) citations.set(citation.chunkId, citation);
    }
  }
  const source = session.source.metadata;
  const map = session.plan.map;
  const content = [
    `# ${source.title} 精读笔记`,
    "",
    "## 来源元数据",
    "",
    `- 来源：${source.kind === "url" ? source.url : source.filename}`,
    `- 类型：${source.genre}`,
    `- 规模：${source.scale}`,
    source.pageCount ? `- 页数：${source.pageCount}` : "",
    "",
    "## 阅读画像",
    "",
    `- 目标：${labelGoal(session.profile.goal)}`,
    `- 熟悉程度：${labelFamiliarity(session.profile.familiarity)}`,
    session.profile.focus ? `- 关注点：${session.profile.focus}` : "",
    "",
    "## 一分钟概览",
    "",
    map.purpose,
    "",
    `核心问题：${map.coreProblem}`,
    "",
    ...map.keyConclusions.map((item) => `- ${item}`),
    "",
    "## 核心术语",
    "",
    ...map.terms.map((item) => `- **${item.term}**：${item.meaning}`),
    "",
    "## 已确认阶段笔记",
    "",
    ...accepted.flatMap((note) => [sanitizeMarkdown(note.content), ""]),
    "## 引用索引",
    "",
    ...(citations.size
      ? [...citations.values()].map((citation) => `- [${citation.chunkId}] ${citation.label}`)
      : ["- 已确认笔记未形成有效引用"]),
    "",
    "> 本笔记由 AI 辅助整理并经用户确认，不能替代原技术文档和正式评审。",
  ]
    .filter((line) => line !== "")
    .join("\n\n");
  const title = source.title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").trim().slice(0, 80) || "technical-document";
  return { filename: `${title}-精读笔记.md`, content: `${content}\n` };
}
