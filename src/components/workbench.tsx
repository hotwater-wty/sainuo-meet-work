"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  LogIn,
  Layers3,
  Link2,
  LoaderCircle,
  Menu,
  MessageSquarePlus,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Save,
  Search,
  Settings,
  Target,
  RefreshCw,
  ShieldCheck,
  SkipForward,
  Upload,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Citation, Familiarity, NoteDraft, ReadingGoal, SessionView } from "@/lib/types";
import { preferredStageId } from "@/lib/stage-selection";

type ImportMode = "file" | "url";

interface ApiErrorBody {
  error?: { code?: string; message?: string; retryable?: boolean };
}

async function apiSession(response: Response): Promise<SessionView> {
  const body = (await response.json()) as { session?: SessionView } & ApiErrorBody;
  if (!response.ok || !body.session) throw new Error(body.error?.message ?? "请求失败");
  return body.session;
}

type WorkbenchView = "home" | "profile" | "reading";
type InspectorTab = "map" | "citations";

interface CitationInspector {
  title: string;
  citations: Citation[];
  insufficient: boolean;
}

export function Workbench({ initialView = "home" }: { initialView?: WorkbenchView }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<SessionView>();
  const [mode, setMode] = useState<ImportMode>("file");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [showImporter, setShowImporter] = useState(true);
  const [showProfile, setShowProfile] = useState(true);
  const [inspectorTabs, setInspectorTabs] = useState<InspectorTab[]>([]);
  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>("map");
  const [citationInspector, setCitationInspector] = useState<CitationInspector>();
  const [selectedStageId, setSelectedStageId] = useState<string>();
  const [stageOpen, setStageOpen] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [selectedFileName, setSelectedFileName] = useState<string>();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const bootstrap = useCallback(async () => {
    setBusy(true);
    setError(undefined);
    try {
      let response = await fetch("/api/sessions/current", { cache: "no-store" });
      if (response.status === 401) response = await fetch("/api/sessions", { method: "POST" });
      const next = await apiSession(response);
      setSession(next);
      setShowImporter(initialView === "home" || !next.source);
      setShowProfile(Boolean(next.source && (!next.plan || initialView === "profile")));
      setSelectedStageId(preferredStageId(next.plan?.stages));
      setStageOpen(initialView === "reading" && Boolean(next.plan?.stages.some((stage) => stage.status !== "pending")));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法创建临时会话");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const confirmReplace = () => !session?.source || window.confirm("替换后当前阅读路线与笔记会被清空。继续吗？");

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || !confirmReplace()) return;
    setBusy(true);
    setError(undefined);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("replace", String(Boolean(session?.source)));
      const next = await apiSession(await fetch("/api/sources/upload", { method: "POST", body: form }));
      setSession(next);
      setShowImporter(false);
      setShowProfile(true);
      setSelectedFileName(undefined);
      router.push("/profile");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "文件导入失败");
    } finally {
      setBusy(false);
    }
  }

  async function importUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmReplace()) return;
    const form = new FormData(event.currentTarget);
    const url = String(form.get("url") ?? "").trim();
    if (!url) return;
    setBusy(true);
    setError(undefined);
    try {
      const next = await apiSession(
        await fetch("/api/sources/import", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url, replace: Boolean(session?.source) }),
        }),
      );
      setSession(next);
      setShowImporter(false);
      setShowProfile(true);
      router.push("/profile");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "URL 导入失败");
    } finally {
      setBusy(false);
    }
  }

  async function generatePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const replace = Boolean(session?.plan);
    if (replace && !window.confirm("重新生成会清空当前阶段进度和笔记。继续吗？")) return;
    setBusy(true);
    setError(undefined);
    try {
      const next = await apiSession(
        await fetch("/api/reading-plan", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            goal: form.get("goal") as ReadingGoal,
            familiarity: form.get("familiarity") as Familiarity,
            focus: String(form.get("focus") ?? "").trim() || undefined,
            selectedScope: String(form.get("selectedScope") ?? "").trim() || undefined,
            replace,
          }),
        }),
      );
      setSession(next);
      setShowProfile(false);
      setSelectedStageId(next.plan?.stages[0]?.id);
      router.push("/reading");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "阅读路线生成失败");
    } finally {
      setBusy(false);
    }
  }

  async function createNewSession() {
    if (session?.source && !window.confirm("新建会话会离开当前文档，且当前临时会话不会保留在列表中。继续吗？")) return;
    setBusy(true);
    try {
      const response = await fetch("/api/sessions?new=1", { method: "POST" });
      await apiSession(response);
      setSession(undefined);
      setShowImporter(true);
      setShowProfile(false);
      setSelectedStageId(undefined);
      setStageOpen(false);
      setStreamingText("");
      router.push("/home");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "新建会话失败");
    } finally {
      setBusy(false);
    }
  }

  async function openSources(stageId: string, title: string) {
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/reading/stages/${stageId}/sources`, { cache: "no-store" });
      const body = (await response.json()) as {
        citations?: Citation[];
        evidenceInsufficient?: boolean;
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(body.error?.message ?? "来源读取失败");
      openCitationInspector({
        title,
        citations: body.citations ?? [],
        insufficient: Boolean(body.evidenceInsufficient),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "来源读取失败");
    } finally {
      setBusy(false);
    }
  }

  function openInspector(tab: InspectorTab) {
    setInspectorTabs((tabs) => (tabs.includes(tab) ? tabs : [...tabs, tab]));
    setActiveInspectorTab(tab);
  }

  function openMapInspector() {
    openInspector("map");
  }

  function openCitationInspector(value: CitationInspector) {
    setCitationInspector(value);
    openInspector("citations");
  }

  function closeInspectorTab(tab: InspectorTab) {
    setInspectorTabs((tabs) => {
      const next = tabs.filter((item) => item !== tab);
      if (activeInspectorTab === tab) setActiveInspectorTab(next.at(-1) ?? "map");
      return next;
    });
  }

  async function runStageAction(
    stageId: string,
    action: "start" | "follow_up" | "rephrase" | "answer_check" | "finish",
    message?: string,
  ): Promise<boolean> {
    setBusy(true);
    setError(undefined);
    setStreamingText("");
    try {
      const response = await fetch(`/api/reading/stages/${stageId}/respond`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, message }),
      });
      if (action === "finish" || !response.headers.get("content-type")?.includes("text/event-stream")) {
        const next = await apiSession(response);
        setSession(next);
        return true;
      }
      if (!response.ok || !response.body) throw new Error("流式响应无法建立");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completed = false;
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const blocks = buffer.split(/\n\n/);
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const line = block.split(/\r?\n/).find((item) => item.startsWith("data:"));
          if (!line) continue;
          const event = JSON.parse(line.slice(5).trim()) as {
            type: "delta" | "complete" | "error";
            text?: string;
            session?: SessionView;
            error?: { message?: string };
          };
          if (event.type === "delta" && event.text) setStreamingText((current) => current + event.text);
          if (event.type === "complete" && event.session) {
            setSession(event.session);
            completed = true;
          }
          if (event.type === "error") throw new Error(event.error?.message ?? "流式响应中断，请重试");
        }
        if (done) break;
      }
      if (!completed) throw new Error("流式响应未完整结束，请重试");
      setStreamingText("");
      return true;
    } catch (caught) {
      setStreamingText("");
      setError(caught instanceof Error ? caught.message : "阶段响应失败");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function generateDraft(stageId: string): Promise<boolean> {
    setBusy(true);
    setError(undefined);
    try {
      const next = await apiSession(
        await fetch(`/api/notes/${stageId}/draft`, { method: "POST" }),
      );
      setSession(next);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "笔记草稿生成失败");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function resolveDraft(
    stageId: string,
    draftId: string,
    action: "accept" | "skip",
    editedContent?: string,
  ): Promise<boolean> {
    setBusy(true);
    setError(undefined);
    try {
      const next = await apiSession(
        await fetch(`/api/notes/${stageId}/accept`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ draftId, action, editedContent }),
        }),
      );
      setSession(next);
      setSelectedStageId(next.plan?.stages.find((stage) => stage.status === "pending")?.id ?? stageId);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "笔记处理失败");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const source = session?.source;
  const expiresAt = session?.expiresAt
    ? new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(
        new Date(session.expiresAt),
      )
    : "--:--";

  return (
    <main className="app-shell">
      <header className="topbar">
        <button
          className="topbar-panel-button"
          type="button"
          title={sidebarCollapsed ? "展开左侧菜单" : "收起左侧菜单"}
          aria-label={sidebarCollapsed ? "展开左侧菜单" : "收起左侧菜单"}
          aria-expanded={!sidebarCollapsed}
          onClick={() => setSidebarCollapsed((value) => !value)}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
        </button>
        <div className="topbar-source" title={source?.title ?? "尚未导入来源"}>
          <FileText size={16} aria-hidden="true" />
          <span>{source?.title ?? "尚未导入来源"}</span>
        </div>
        <div className="topbar-actions">
          {source && session?.plan && (
            <button className="topbar-inspector-button" type="button" onClick={openMapInspector} aria-label="打开阅读导航和来源检查器" title="打开阅读导航和来源检查器">
              <Layers3 size={17} />
              <span>阅读导航</span>
            </button>
          )}
          <div className="session-status" title="最后活动两小时后会话自动清理">
          <Clock3 size={16} aria-hidden="true" />
          <span>临时会话至 {expiresAt}</span>
          </div>
        </div>
      </header>

      <div className={`workspace${sidebarCollapsed ? " sidebar-collapsed" : ""}${inspectorTabs.length ? " inspector-open" : ""}`}>
        <aside className="source-rail" aria-label="当前来源">
          <div className="rail-toolbar">
            <button className="rail-brand" type="button" title="返回首页" onClick={() => router.push("/home")}>
              <span className="brand-mark" aria-hidden="true">L</span>
              <span><strong>Lumen</strong><small>技术文档精读</small></span>
            </button>
            <button className="rail-new-button" type="button" title="新建阅读会话" onClick={() => void createNewSession()}>
              <MessageSquarePlus size={17} />
              <span>新建会话</span>
            </button>
          </div>
          <div className="rail-nav" aria-label="工作区导航">
            <button
              className="rail-nav-item active"
              type="button"
              title="当前阅读"
              onClick={() => router.push(session?.plan ? "/reading" : session?.source ? "/profile" : "/home")}
            >
              <Menu size={16} />
              <span>当前阅读</span>
            </button>
            <button className="rail-nav-item" type="button" title="历史会话（即将推出）" onClick={() => setNotice("历史会话功能将在后续版本开放") }>
              <Clock3 size={16} />
              <span>历史会话</span>
            </button>
          </div>
          <div className="rail-heading">
            <span>当前来源</span>
            {source && (
              <button
                className="icon-button"
                type="button"
                title="替换来源"
                aria-label="替换来源"
                onClick={() => {
                  setShowImporter(true);
                  setShowProfile(false);
                  router.push("/home");
                }}
              >
                <RefreshCw size={17} />
              </button>
            )}
          </div>

          {source ? (
            <div className="source-details">
              <div className="source-card" tabIndex={0} aria-label={`${source.title}，悬浮查看来源详情`}>
              <div className="source-title-row" title={source.title}>
                <FileText size={20} aria-hidden="true" />
                <strong>{source.title}</strong>
              </div>
              <div className="source-hover-panel">
              <dl className="metadata-list">
                <div>
                  <dt>类型</dt>
                  <dd>{source.genre}</dd>
                </div>
                <div>
                  <dt>规模</dt>
                  <dd>{source.scale}</dd>
                </div>
                {source.pageCount && (
                  <div>
                    <dt>页数</dt>
                    <dd>{source.pageCount}</dd>
                  </div>
                )}
                <div>
                  <dt>索引</dt>
                  <dd>{source.chunkCount} 个来源块</dd>
                </div>
              </dl>
              <div className="quality-heading">
                <ShieldCheck size={16} aria-hidden="true" />
                <span>解析质量</span>
              </div>
              <div className="coverage-row">
                <span>文本覆盖</span>
                <strong>{Math.round(source.quality.textCoverage * 100)}%</strong>
              </div>
              {source.quality.warnings.length ? (
                <ul className="warning-list">
                  {source.quality.warnings.map((warning) => (
                    <li key={warning}>
                      <AlertTriangle size={15} aria-hidden="true" />
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="quality-ok">
                  <CheckCircle2 size={16} aria-hidden="true" />
                  <span>未发现阻断性问题</span>
                </div>
              )}
              </div>
              </div>
            </div>
          ) : (
            <div className="empty-source">
              <FileText size={22} aria-hidden="true" />
              <span>尚未导入文档</span>
            </div>
          )}
          <div className="rail-footer">
            <button className="rail-nav-item" type="button" title="设置（即将推出）" onClick={() => setNotice("设置功能将在后续版本开放") }>
              <Settings size={16} />
              <span>设置</span>
            </button>
            <button className="rail-nav-item" type="button" title="登录（即将推出）" onClick={() => setNotice("登录功能将在后续版本开放") }>
              <LogIn size={16} />
              <span>登录</span>
            </button>
          </div>
        </aside>

        <section className="main-workspace">
          {pathname !== "/" && pathname !== "/home" && (
            <button className="main-back-button" type="button" title="返回上一页" aria-label="返回上一页" onClick={() => router.back()}>
              <ArrowLeft size={19} />
              <span>返回</span>
            </button>
          )}
          {error && (
            <div className="error-banner" role="alert">
              <AlertTriangle size={18} aria-hidden="true" />
              <span>{error}</span>
              <button type="button" onClick={() => setError(undefined)} aria-label="关闭错误提示">
                关闭
              </button>
            </div>
          )}
          {notice && (
            <div className="notice-banner" role="status">
              <span>{notice}</span>
              <button type="button" onClick={() => setNotice(undefined)} aria-label="关闭提示">
                关闭
              </button>
            </div>
          )}

          {(showImporter || !source) && (
            <section className="import-tool" aria-labelledby="import-heading">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">步骤 1 / 4 · 来源导入</span>
                  <h2 id="import-heading">导入本次精读材料</h2>
                </div>
                <span className="limit-label">单文件 10 MB</span>
              </div>
              <div className="segmented" role="tablist" aria-label="导入方式">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "file"}
                  className={mode === "file" ? "active" : ""}
                  onClick={() => setMode("file")}
                >
                  <Upload size={17} aria-hidden="true" /> 文件
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "url"}
                  className={mode === "url" ? "active" : ""}
                  onClick={() => setMode("url")}
                >
                  <Link2 size={17} aria-hidden="true" /> URL
                </button>
              </div>

              {mode === "file" ? (
                <form className="import-form" onSubmit={upload}>
                  <label className="file-input">
                    <Upload size={22} aria-hidden="true" />
                    <span>PDF、Markdown、TXT 或 HTML</span>
                    <input
                      ref={fileRef}
                      name="file"
                      type="file"
                      accept=".pdf,.md,.markdown,.txt,.html,.htm"
                      required
                      onChange={(event) => setSelectedFileName(event.currentTarget.files?.[0]?.name)}
                    />
                  </label>
                  {selectedFileName && (
                    <div className="file-selected" role="status">
                      <CheckCircle2 size={17} aria-hidden="true" />
                      <span><strong>已选择：</strong>{selectedFileName}</span>
                      <small>点击“解析并继续”后，系统会提取正文并进入阅读目标设置。</small>
                    </div>
                  )}
                  <button className="primary-button" type="submit" disabled={busy}>
                    {busy ? <LoaderCircle className="spin" size={18} /> : <Upload size={18} />}
                    {busy ? "正在解析文档" : "解析并继续"}
                  </button>
                </form>
              ) : (
                <form className="import-form url-form" onSubmit={importUrl}>
                  <label>
                    <span>公开文档地址</span>
                    <input name="url" type="url" placeholder="https://www.rfc-editor.org/rfc/rfc6455.html" required />
                  </label>
                  <button className="primary-button" type="submit" disabled={busy}>
                    {busy ? <LoaderCircle className="spin" size={18} /> : <Link2 size={18} />}
                    {busy ? "正在读取文档" : "读取并继续"}
                  </button>
                </form>
              )}
            </section>
          )}

          {source && !showImporter && showProfile && (
            <ProfileForm session={session} busy={busy} onSubmit={generatePlan} />
          )}

          {source && session?.plan && !showImporter && !showProfile && (
            <PlanView
              session={session}
              busy={busy}
              selectedStageId={selectedStageId}
              streamingText={streamingText}
              stageOpen={stageOpen}
              onStageOpenChange={setStageOpen}
              onEditProfile={() => { setShowProfile(true); router.push("/profile"); }}
              onOpenSources={openSources}
              onOpenMapInspector={openMapInspector}
              onOpenMessageCitations={(title, citations) => openCitationInspector({ title, citations, insufficient: citations.length === 0 })}
              onSelectStage={setSelectedStageId}
              onStageAction={runStageAction}
              onGenerateDraft={generateDraft}
              onResolveDraft={resolveDraft}
            />
          )}
        </section>
      </div>
      {session?.plan && inspectorTabs.length > 0 && (
        <InspectorPanel
          tabs={inspectorTabs}
          activeTab={activeInspectorTab}
          citationValue={citationInspector}
          session={session}
          busy={busy}
          selectedStageId={selectedStageId}
          onActivate={setActiveInspectorTab}
          onCloseTab={closeInspectorTab}
          onEditProfile={() => { setShowProfile(true); router.push("/profile"); }}
          onOpenSources={openSources}
          onOpenStage={(stageId) => {
            const target = session.plan?.stages.find((stage) => stage.id === stageId);
            setSelectedStageId(stageId);
            setStageOpen(true);
            if (target?.status === "pending") void runStageAction(stageId, "start");
          }}
        />
      )}
    </main>
  );
}

function ProfileForm({
  session,
  busy,
  onSubmit,
}: {
  session: SessionView;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const source = session.source;
  const defaultGoal = session.profile?.goal ?? "overview";
  const defaultFamiliarity = session.profile?.familiarity ?? "new";
  const scopeOptions = source?.outline.length
    ? source.outline
    : source?.pageCount
      ? Array.from({ length: Math.min(6, source.pageCount) }, (_, index) => {
          const group = Math.ceil(source.pageCount! / 6);
          const start = index * group + 1;
          return `第 ${start}-${Math.min(start + group - 1, source.pageCount!)} 页`;
        }).filter((value, index, array) => index === 0 || value !== array[index - 1])
      : ["全文"];

  return (
    <section className="profile-tool" aria-labelledby="profile-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">步骤 2 / 4 · 阅读画像</span>
          <h2 id="profile-heading">设置本次阅读目标</h2>
        </div>
        {session.plan && <span className="limit-label">重新生成会重置进度</span>}
      </div>
      {!session.plan && (
        <p className="step-guidance">完成设置后，系统将生成阅读路线；随后可按阶段精读、核对来源，并确认导出笔记。</p>
      )}
      <form className="profile-form" onSubmit={onSubmit}>
        <fieldset>
          <legend>阅读目标</legend>
          <div className="choice-grid goal-grid">
            {[
              ["overview", "建立全局认知", "先看问题、结构和机制链路"],
              ["mechanism", "深入理解机制", "聚焦约束、例外和概念关系"],
              ["implementation", "准备实现评审", "提取条件、风险和落地要求"],
            ].map(([value, label, description]) => (
              <label key={value}>
                <input type="radio" name="goal" value={value} defaultChecked={defaultGoal === value} />
                <span>
                  <Target size={17} aria-hidden="true" />
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>熟悉程度</legend>
          <div className="choice-grid familiarity-grid">
            {[
              ["new", "初次接触"],
              ["basic", "了解基础"],
              ["experienced", "已有实践"],
            ].map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="familiarity"
                  value={value}
                  defaultChecked={defaultFamiliarity === value}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {source?.scale === "book" && (
          <label className="field-label">
            <span>精读范围</span>
            <select name="selectedScope" defaultValue={session.profile?.selectedScope ?? ""} required>
              <option value="" disabled>
                选择章节或页段
              </option>
              {scopeOptions.map((scope) => (
                <option key={scope} value={scope}>
                  {scope}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="field-label">
          <span>关注点（可选）</span>
          <textarea
            name="focus"
            rows={3}
            maxLength={500}
            defaultValue={session.profile?.focus}
            placeholder="例如：重点关注事务边界与消息一致性"
          />
        </label>
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={18} /> : <Layers3 size={18} />}
          {session.plan ? "重新生成路线" : "生成阅读路线"}
        </button>
      </form>
    </section>
  );
}

function PlanView({
  session,
  busy,
  selectedStageId,
  streamingText,
  stageOpen,
  onStageOpenChange,
  onEditProfile,
  onOpenSources,
  onOpenMapInspector,
  onOpenMessageCitations,
  onSelectStage,
  onStageAction,
  onGenerateDraft,
  onResolveDraft,
}: {
  session: SessionView;
  busy: boolean;
  selectedStageId?: string;
  streamingText: string;
  stageOpen: boolean;
  onStageOpenChange: (open: boolean) => void;
  onEditProfile: () => void;
  onOpenSources: (stageId: string, title: string) => void;
  onOpenMapInspector: () => void;
  onOpenMessageCitations: (title: string, citations: Citation[]) => void;
  onSelectStage: (stageId: string) => void;
  onStageAction: (
    stageId: string,
    action: "start" | "follow_up" | "rephrase" | "answer_check" | "finish",
    message?: string,
  ) => Promise<boolean>;
  onGenerateDraft: (stageId: string) => Promise<boolean>;
  onResolveDraft: (
    stageId: string,
    draftId: string,
    action: "accept" | "skip",
    editedContent?: string,
  ) => Promise<boolean>;
}) {
  const plan = session.plan!;
  const selectedStage = plan.stages.find((stage) => stage.id === selectedStageId);

  useEffect(() => {
    if (selectedStage && selectedStage.status !== "pending") onStageOpenChange(true);
  }, [onStageOpenChange, selectedStage?.id, selectedStage?.status]);

  function openStage(stageId: string, start = false) {
    onSelectStage(stageId);
    onStageOpenChange(true);
    if (start) void onStageAction(stageId, "start");
  }

  const map = (
    <DocumentMapPanel
      plan={plan}
      session={session}
      onEditProfile={onEditProfile}
      onExport={() => undefined}
      canExport={session.notes.some((note) => note.status === "accepted")}
    />
  );
  const route = (
    <RouteSection
      plan={plan}
      session={session}
      busy={busy}
      selectedStageId={selectedStageId}
      onOpenSources={onOpenSources}
      onSelectStage={(stageId) => openStage(stageId, plan.stages.find((item) => item.id === stageId)?.status === "pending")}
    />
  );
  return (
    <div className={`plan-workspace${stageOpen ? " stage-open" : ""}`}>
      {!stageOpen ? (
        <>
          {map}
          {selectedStage && selectedStage.status === "pending" && (
            <section className="stage-launcher" aria-label="开始当前阶段">
              <div>
                <span className="eyebrow">准备好后开始精读</span>
                <strong>{selectedStage.title}</strong>
                <p>{selectedStage.objective}</p>
              </div>
              <button className="primary-button" type="button" disabled={busy} onClick={() => openStage(selectedStage.id, true)}>
                {busy ? <LoaderCircle className="spin" size={18} /> : <ChevronRight size={18} />}
                开始本阶段
              </button>
            </section>
          )}
          {route}
        </>
      ) : (
        <section className="reading-workbench-shell" aria-label="阶段精读工作台">
          <div className="reading-workbench-toolbar">
            <div>
              <span className="eyebrow">步骤 4 / 4 · 阶段精读</span>
              <strong>{selectedStage?.title ?? "当前阶段"}</strong>
            </div>
            <button className="secondary-button" type="button" onClick={onOpenMapInspector}>
              <Layers3 size={16} /> 查看文档地图
            </button>
          </div>
          {selectedStage && (
            <StageWorkspace
              stage={selectedStage}
              busy={busy}
              streamingText={streamingText}
              onAction={onStageAction}
              onOpenCitations={onOpenMessageCitations}
              note={session.notes.find((item) => item.stageId === selectedStage.id)}
              onGenerateDraft={onGenerateDraft}
              onResolveDraft={onResolveDraft}
            />
          )}
        </section>
      )}
    </div>
  );
}

function DocumentMapPanel({ plan, session, onEditProfile, onExport, canExport }: { plan: NonNullable<SessionView["plan"]>; session: SessionView; onEditProfile: () => void; onExport: () => void; canExport: boolean }) {
  return (
    <section className="document-map" aria-labelledby="map-heading">
      <div className="section-heading compact-heading">
        <div>
          <span className="eyebrow">文档地图</span>
          <h2 id="map-heading">{plan.map.coreProblem}</h2>
        </div>
        <div className="map-actions">
          <button className="secondary-button" type="button" onClick={onEditProfile}><RefreshCw size={16} /> 调整画像</button>
          {canExport && <a className="secondary-button download-button" href="/api/notes/export" download onClick={onExport}><Download size={16} /> 导出笔记</a>}
        </div>
      </div>
      <p className="map-purpose">{plan.map.purpose}</p>
      <div className="map-columns">
        <div><h3>关键结论</h3><ul>{plan.map.keyConclusions.map((item) => <li key={item}>{item}</li>)}</ul></div>
        <div><h3>前置知识</h3>{plan.map.prerequisites.length ? <ul>{plan.map.prerequisites.map((item) => <li key={item}>{item}</li>)}</ul> : <p>无额外前置要求</p>}</div>
      </div>
      <div className="term-strip" aria-label="核心术语">{plan.map.terms.map((item) => <span key={item.term} title={item.meaning}>{item.term}</span>)}</div>
      {plan.map.limitations.length > 0 && <ul className="map-limitations">{plan.map.limitations.map((item) => <li key={item}>{item}</li>)}</ul>}
    </section>
  );
}

function RouteSection({ plan, session, busy, selectedStageId, onOpenSources, onSelectStage }: { plan: NonNullable<SessionView["plan"]>; session: SessionView; busy: boolean; selectedStageId?: string; onOpenSources: (stageId: string, title: string) => void; onSelectStage: (stageId: string) => void }) {
  return (
    <section className="route-section" aria-labelledby="route-heading">
      <div className="route-heading-row"><div><span className="eyebrow">步骤 3 / 4 · 精读路线</span><h2 id="route-heading">{plan.stages.length} 个阶段</h2></div><span className="profile-summary">{profileLabel(session.profile?.goal)} · {familiarityLabel(session.profile?.familiarity)}</span></div>
      <ol className="stage-list">{plan.stages.map((stage, index) => <li key={stage.id} className={selectedStageId === stage.id ? "selected" : ""}>
        <div className="stage-index">{String(index + 1).padStart(2, "0")}</div>
        <div className="stage-copy"><div className="stage-title-line"><h3>{stage.title}</h3><span className={`stage-status ${stage.status}`}>{stageStatusLabel(stage.status)}</span></div><p>{stage.objective}</p><small>{stage.rationale}</small><div className="scope-row">{stage.sourceScopes.map((scope) => <span key={scope}>{scope}</span>)}</div></div>
        <div className="stage-actions"><button className="icon-button" type="button" title="查看阶段依据" aria-label={`查看${stage.title}的阶段依据`} disabled={busy} onClick={() => onOpenSources(stage.id, stage.title)}><Search size={17} /></button><button className="icon-button" type="button" title={stage.status === "pending" ? "开始阶段" : "查看阶段"} aria-label={`${stage.status === "pending" ? "开始" : "查看"}${stage.title}`} disabled={busy} onClick={() => onSelectStage(stage.id)}><ChevronRight size={18} /></button></div>
      </li>)}</ol>
    </section>
  );
}

function StageWorkspace({
  stage,
  busy,
  streamingText,
  onAction,
  onOpenCitations,
  note,
  onGenerateDraft,
  onResolveDraft,
}: {
  stage: NonNullable<SessionView["plan"]>["stages"][number];
  busy: boolean;
  streamingText: string;
  onAction: (
    stageId: string,
    action: "start" | "follow_up" | "rephrase" | "answer_check" | "finish",
    message?: string,
  ) => Promise<boolean>;
  onOpenCitations: (title: string, citations: Citation[]) => void;
  note?: NoteDraft;
  onGenerateDraft: (stageId: string) => Promise<boolean>;
  onResolveDraft: (
    stageId: string,
    draftId: string,
    action: "accept" | "skip",
    editedContent?: string,
  ) => Promise<boolean>;
}) {
  const [input, setInput] = useState("");
  const messagesRef = useRef<HTMLDivElement>(null);

  async function submit(action: "follow_up" | "answer_check") {
    const value = input.trim();
    if (!value) return;
    if (await onAction(stage.id, action, value)) setInput("");
  }

  return (
    <section className="stage-workspace" aria-labelledby="active-stage-heading">
      <div className="stage-workspace-heading">
        <div>
          <span className="eyebrow">步骤 4 / 4 · 阶段精读 · {stage.id}</span>
          <h2 id="active-stage-heading">{stage.title}</h2>
          <p>{stage.objective}</p>
        </div>
        <span className={`stage-status ${stage.status}`}>{stageStatusLabel(stage.status)}</span>
      </div>

      {stage.status === "pending" && !streamingText && (
        <button className="primary-button" type="button" disabled={busy} onClick={() => void onAction(stage.id, "start")}>
          {busy ? <LoaderCircle className="spin" size={18} /> : <ChevronRight size={18} />}
          开始本阶段
        </button>
      )}

      <div ref={messagesRef} className="message-list" aria-live="polite">
        {stage.messages.map((message) => (
          <article key={message.id} className={`reading-message ${message.role}`}>
            <span className="message-role">{message.role === "assistant" ? "精读助手" : "你"}</span>
            {message.role === "assistant" ? (
              <MarkdownMessage content={message.content} citations={message.citations} onOpenCitations={onOpenCitations} title={stage.title} />
            ) : (
              <div className="user-bubble">{message.content}</div>
            )}
            {message.citations.length > 0 && (
              <button
                className="citation-button"
                type="button"
                onClick={() => onOpenCitations(stage.title, message.citations)}
              >
                <Search size={14} /> {message.citations.length} 条来源
              </button>
            )}
          </article>
        ))}
        {streamingText && (
          <article className="reading-message assistant streaming">
            <span className="message-role">精读助手 · 生成中</span>
            <p>{streamingText}</p>
          </article>
        )}
      </div>

      <button className="scroll-bottom-button" type="button" title="跳到最新内容" aria-label="跳到最新内容" onClick={() => messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" })}>
        <ArrowDown size={18} />
      </button>

      {stage.status === "active" && !busy && (
        <div className="stage-controls">
          {stage.checkQuestion && (
            <div className="check-question">
              <strong>理解检查</strong>
              <p>{stage.checkQuestion}</p>
            </div>
          )}
          <label className="field-label">
            <span>继续本阶段</span>
            <textarea
              value={input}
              maxLength={2_000}
              rows={3}
              onChange={(event) => setInput(event.target.value)}
              placeholder="输入追问，或写下你对理解检查的回答"
            />
          </label>
          <div className="stage-control-buttons">
            <button className="secondary-button" type="button" disabled={!input.trim()} onClick={() => void submit("follow_up")}>
              提交追问
            </button>
            <button className="secondary-button" type="button" disabled={!input.trim()} onClick={() => void submit("answer_check")}>
              回答检查
            </button>
            <button className="secondary-button" type="button" onClick={() => void onAction(stage.id, "rephrase")}>
              <RefreshCw size={16} /> 换一种解释
            </button>
            <button className="primary-button" type="button" onClick={() => void onAction(stage.id, "finish")}>
              结束阶段
            </button>
          </div>
        </div>
      )}

      {stage.status === "awaiting_note" && !note && (
        <div className="awaiting-note note-prompt">
          <NotebookPen size={18} />
          <span>讲解已结束，生成草稿后可编辑、接受或跳过。</span>
          <button className="primary-button" type="button" disabled={busy} onClick={() => void onGenerateDraft(stage.id)}>
            {busy ? <LoaderCircle className="spin" size={18} /> : <NotebookPen size={18} />}
            生成阶段笔记
          </button>
        </div>
      )}

      {stage.status === "awaiting_note" && note?.status === "pending" && (
        <NoteEditor key={note.id} note={note} busy={busy} onResolve={(action, content) => onResolveDraft(stage.id, note.id, action, content)} />
      )}

      {stage.status === "completed" && note?.status === "accepted" && (
        <div className="accepted-note">
          <div><CheckCircle2 size={17} /><strong>已确认笔记</strong></div>
          <pre>{note.content}</pre>
        </div>
      )}

      {stage.status === "completed" && note?.status === "skipped" && (
        <div className="awaiting-note"><SkipForward size={18} /><span>本阶段已完成，笔记已跳过。</span></div>
      )}
    </section>
  );
}

function MarkdownMessage({ content, citations, onOpenCitations, title }: { content: string; citations: Citation[]; onOpenCitations: (title: string, citations: Citation[]) => void; title: string }) {
  const allowed = new Map(citations.map((citation) => [citation.chunkId, citation]));
  const markdown = content.replace(/\[(S\d+)\]/g, (match, id: string) => allowed.has(id) ? `[${id}](#citation-${id})` : match);
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, children }) => {
            if (href?.startsWith("#citation-")) {
              const citation = allowed.get(href.slice("#citation-".length));
              if (citation) return <button className="inline-citation" type="button" onClick={() => onOpenCitations(title, [citation])}>{children}</button>;
            }
            return <a href={href}>{children}</a>;
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

function NoteEditor({
  note,
  busy,
  onResolve,
}: {
  note: NoteDraft;
  busy: boolean;
  onResolve: (action: "accept" | "skip", content?: string) => Promise<boolean>;
}) {
  const [content, setContent] = useState(note.content);
  return (
    <section className="note-editor" aria-labelledby="note-editor-heading">
      <div className="note-editor-heading">
        <div>
          <span className="eyebrow">AI 草稿</span>
          <h3 id="note-editor-heading">确认本阶段笔记</h3>
        </div>
        <span>{content.length.toLocaleString("zh-CN")} / 20,000</span>
      </div>
      <textarea
        value={content}
        maxLength={20_000}
        rows={18}
        disabled={busy}
        onChange={(event) => setContent(event.target.value)}
      />
      <div className="note-actions">
        <button className="secondary-button" type="button" disabled={busy} onClick={() => void onResolve("skip")}>
          <SkipForward size={16} /> 跳过笔记
        </button>
        <button
          className="primary-button"
          type="button"
          disabled={busy || !content.trim()}
          onClick={() => void onResolve("accept", content)}
        >
          {busy ? <LoaderCircle className="spin" size={18} /> : <Save size={17} />}
          接受并完成阶段
        </button>
      </div>
    </section>
  );
}

function InspectorPanel({
  tabs,
  activeTab,
  citationValue,
  session,
  busy,
  selectedStageId,
  onActivate,
  onCloseTab,
  onEditProfile,
  onOpenSources,
  onOpenStage,
}: {
  tabs: InspectorTab[];
  activeTab: InspectorTab;
  citationValue?: CitationInspector;
  session: SessionView;
  busy: boolean;
  selectedStageId?: string;
  onActivate: (tab: InspectorTab) => void;
  onCloseTab: (tab: InspectorTab) => void;
  onEditProfile: () => void;
  onOpenSources: (stageId: string, title: string) => void;
  onOpenStage: (stageId: string) => void;
}) {
  const plan = session.plan!;
  return (
    <aside className="inspector-panel" aria-label="阅读导航和来源检查器">
      <div className="inspector-tabs" role="tablist" aria-label="检查器标签">
        {tabs.map((tab) => {
          const label = tab === "map" ? "文档地图" : citationValue?.title ?? "来源引用";
          return (
            <div key={tab} className={`inspector-tab${activeTab === tab ? " active" : ""}`}>
              <button type="button" role="tab" aria-selected={activeTab === tab} onClick={() => onActivate(tab)}>{tab === "map" ? <Layers3 size={15} /> : <Search size={15} />}<span>{label}</span></button>
              <button className="inspector-tab-close" type="button" title={`关闭${label}`} aria-label={`关闭${label}`} onClick={() => onCloseTab(tab)}><X size={14} /></button>
            </div>
          );
        })}
      </div>
      <div className="inspector-content">
        {activeTab === "map" && tabs.includes("map") && (
          <>
            <div className="inspector-heading"><div><span className="eyebrow">阅读导航</span><h2>文档地图与路线</h2></div><button className="icon-button" type="button" title="关闭文档地图" aria-label="关闭文档地图" onClick={() => onCloseTab("map")}><X size={18} /></button></div>
            <DocumentMapPanel plan={plan} session={session} onEditProfile={onEditProfile} onExport={() => undefined} canExport={session.notes.some((note) => note.status === "accepted")} />
            <RouteSection plan={plan} session={session} busy={busy} selectedStageId={selectedStageId} onOpenSources={onOpenSources} onSelectStage={onOpenStage} />
          </>
        )}
        {activeTab === "citations" && tabs.includes("citations") && (
          <>
            <div className="inspector-heading"><div><span className="eyebrow">来源依据</span><h2>{citationValue?.title ?? "来源引用"}</h2></div><button className="icon-button" type="button" title="关闭来源引用" aria-label="关闭来源引用" onClick={() => onCloseTab("citations")}><X size={18} /></button></div>
            {citationValue?.insufficient ? <div className="drawer-empty">文档中未找到足够依据</div> : <ol className="citation-list">{citationValue?.citations.map((citation) => <li key={citation.chunkId}><div><span>{citation.chunkId}</span><strong>{citation.label}</strong></div><p>{citation.excerpt}</p></li>)}</ol>}
          </>
        )}
      </div>
    </aside>
  );
}

function profileLabel(goal?: ReadingGoal): string {
  return { overview: "全局认知", mechanism: "机制理解", implementation: "实现评审" }[goal ?? "overview"];
}

function familiarityLabel(value?: Familiarity): string {
  return { new: "初次接触", basic: "了解基础", experienced: "已有实践" }[value ?? "new"];
}

function stageStatusLabel(value: string): string {
  return { pending: "待开始", active: "进行中", awaiting_note: "待确认笔记", completed: "已完成" }[value] ?? value;
}
