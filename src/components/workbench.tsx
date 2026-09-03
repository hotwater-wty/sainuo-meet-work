"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  LogIn,
  Layers3,
  Link2,
  LoaderCircle,
  MessageSquarePlus,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
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

type WorkbenchView = "home" | "profile" | "reading" | "stage";
type InspectorTab = "source" | "map" | "conversation" | "citations";
type PendingNavigation = "back" | "exit";

interface CitationInspector {
  title: string;
  citations: Citation[];
  insufficient: boolean;
}

interface SourcePreview {
  title: string;
  outline: string[];
  chunks: Array<{ id: string; text: string; page?: number; headingPath: string[] }> ;
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
  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>("source");
  const [citationInspector, setCitationInspector] = useState<CitationInspector>();
  const [sourcePreview, setSourcePreview] = useState<SourcePreview>();
  const [previewBusy, setPreviewBusy] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string>();
  const [stageOpen, setStageOpen] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [selectedFileName, setSelectedFileName] = useState<string>();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation>();
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
      setStageOpen(initialView === "stage" && Boolean(next.plan?.stages.some((stage) => stage.status === "active" || stage.status === "awaiting_note")));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法创建临时会话");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (inspectorTabs.length && !sourcePreview) void loadSourcePreview();
  }, [inspectorTabs.length, sourcePreview]);

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
      setSourcePreview(undefined);
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
      setSourcePreview(undefined);
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
      setSourcePreview(undefined);
      router.push("/home");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "新建会话失败");
    } finally {
      setBusy(false);
    }
  }

  async function endCurrentSession() {
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch("/api/sessions/current", { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json()) as ApiErrorBody;
        throw new Error(body.error?.message ?? "暂时无法结束当前会话");
      }
      setSession(undefined);
      setSelectedStageId(undefined);
      setStageOpen(false);
      setStreamingText("");
      setInspectorTabs([]);
      setSourcePreview(undefined);
      setPendingNavigation(undefined);
      router.push("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "暂时无法结束当前会话");
    } finally {
      setBusy(false);
    }
  }

  function requestBackNavigation() {
    if (pathname === "/home") {
      router.push("/");
      return;
    }
    setPendingNavigation("back");
  }

  function confirmBackNavigation() {
    setPendingNavigation(undefined);
    if (pathname === "/profile") {
      setShowImporter(true);
      setShowProfile(false);
      router.push("/home");
      return;
    }
    if (pathname === "/reading/stage") {
      setStageOpen(false);
      router.push("/reading");
      return;
    }
    setShowImporter(false);
    setShowProfile(true);
    router.push("/profile");
  }

  async function enterStage(stageId: string, start = false) {
    setSelectedStageId(stageId);
    setStageOpen(true);
    if (start) {
      if (await runStageAction(stageId, "start")) router.replace("/reading/stage");
      return;
    }
    router.push("/reading/stage");
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
    setInspectorTabs((tabs) => {
      const base: InspectorTab[] = tabs.length ? tabs : ["source", "map", "conversation"];
      return base.includes(tab) ? base : [...base, tab];
    });
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
    if (tab === "source" || tab === "map" || tab === "conversation") return;
    setInspectorTabs((tabs) => {
      const next = tabs.filter((item) => item !== tab);
      if (activeInspectorTab === tab) setActiveInspectorTab(next.at(-1) ?? "map");
      return next;
    });
  }

  function toggleInspector() {
    if (inspectorTabs.length) {
      setInspectorTabs([]);
      return;
    }
    setInspectorTabs(["source", "map", "conversation"]);
    setActiveInspectorTab("source");
    void loadSourcePreview();
  }

  async function loadSourcePreview() {
    if (sourcePreview || previewBusy) return;
    setPreviewBusy(true);
    try {
      const response = await fetch("/api/sources/preview", { cache: "no-store" });
      const body = (await response.json()) as { preview?: SourcePreview } & ApiErrorBody;
      if (!response.ok || !body.preview) throw new Error(body.error?.message ?? "原文预览读取失败");
      setSourcePreview(body.preview);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "原文预览读取失败");
    } finally {
      setPreviewBusy(false);
    }
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
        if (action === "finish") {
          setInspectorTabs((tabs) => tabs.length ? (tabs.includes("conversation") ? tabs : [...tabs, "conversation"]) : ["source", "map", "conversation"]);
          setActiveInspectorTab("conversation");
        }
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

  async function skipDraft(stageId: string): Promise<boolean> {
    setBusy(true);
    setError(undefined);
    try {
      const next = await apiSession(await fetch(`/api/notes/${stageId}/skip`, { method: "POST" }));
      setSession(next);
      setSelectedStageId(next.plan?.stages.find((stage) => stage.status === "pending")?.id ?? stageId);
      setStageOpen(false);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "跳过笔记失败");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function finishStageWithNoteDecision(stageId: string, decision: "generate" | "skip"): Promise<boolean> {
    const finished = await runStageAction(stageId, "finish");
    if (!finished) return false;
    return decision === "generate" ? generateDraft(stageId) : skipDraft(stageId);
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
      const nextPending = next.plan?.stages.find((stage) => stage.status === "pending")?.id;
      setSelectedStageId(nextPending ?? stageId);
      setStageOpen(false);
      if (action === "accept") {
        // 接受笔记后立即下载当前会话的 Markdown 成果，避免用户误以为按钮无效。
        const link = document.createElement("a");
        link.href = "/api/notes/export";
        link.download = "精读笔记.md";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "笔记处理失败");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const source = session?.source;
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
            <button
              className="topbar-inspector-button"
              type="button"
              onClick={toggleInspector}
              aria-label={inspectorTabs.length ? "收起右侧边栏" : "展开右侧边栏"}
              title={inspectorTabs.length ? "收起右侧边栏" : "展开右侧边栏"}
              aria-expanded={Boolean(inspectorTabs.length)}
            >
              {inspectorTabs.length ? <PanelRightClose size={19} /> : <PanelRightOpen size={19} />}
            </button>
          )}
        </div>
      </header>

      <div className={`workspace${sidebarCollapsed ? " sidebar-collapsed" : ""}${inspectorTabs.length ? " inspector-open" : ""}`}>
        <aside className="source-rail" aria-label="当前来源">
          <div className="rail-toolbar">
            <button className="rail-brand" type="button" title="返回首页" onClick={() => source ? setPendingNavigation("exit") : router.push("/")}>
              <span className="brand-mark" aria-hidden="true">L</span>
              <span><strong>Lumen</strong><small>技术文档精读</small></span>
            </button>
            <button className="rail-new-button" type="button" title="新建阅读会话" onClick={() => void createNewSession()}>
              <MessageSquarePlus size={17} />
              <span>新建会话</span>
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
          {stageOpen && selectedStageId && session?.plan && (() => {
            const currentStage = session.plan.stages.find((stage) => stage.id === selectedStageId);
            return currentStage ? (
              <div className="rail-reading-context" aria-label="当前精读阶段">
                <span className="eyebrow">当前精读阶段 · {currentStage.id}</span>
                <strong title={currentStage.title}>{currentStage.title}</strong>
                <p title={currentStage.objective}>{currentStage.objective}</p>
                <span className={`stage-status ${currentStage.status}`}>{stageStatusLabel(currentStage.status)}</span>
              </div>
            ) : null;
          })()}
          <div className="rail-footer">
            <button className="rail-nav-item" type="button" title="设置（即将推出）" onClick={() => setNotice("设置功能将在后续版本开放")}>
              <Settings size={16} />
              <span>设置</span>
            </button>
            <button className="rail-nav-item" type="button" title="登录（即将推出）" onClick={() => setNotice("登录功能将在后续版本开放")}>
              <LogIn size={16} />
              <span>登录</span>
            </button>
          </div>
        </aside>

        <section className="main-workspace">
          {pathname !== "/" && !busy && (
            <button className="main-back-button" type="button" title={pathname === "/home" ? "返回首页" : "返回上一步"} aria-label="返回" onClick={requestBackNavigation}>
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
                    <span className="file-input-cta">选择文件</span>
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
            <ProfileForm
              session={session}
              busy={busy}
              onSubmit={generatePlan}
              onCancel={() => {
                setShowProfile(false);
                router.push("/reading");
              }}
            />
          )}

          {source && session?.plan && !showImporter && !showProfile && (
            <PlanView
              session={session}
              busy={busy}
              selectedStageId={selectedStageId}
              streamingText={streamingText}
              stageOpen={stageOpen}
              onEditProfile={() => { setShowProfile(true); router.push("/profile"); }}
              onExit={() => setPendingNavigation("exit")}
              onComplete={() => void endCurrentSession()}
              onOpenSources={openSources}
              onOpenMessageCitations={(title, citations) => openCitationInspector({ title, citations, insufficient: citations.length === 0 })}
              onEnterStage={enterStage}
              onStageAction={runStageAction}
              onGenerateDraft={generateDraft}
              onFinishWithNoteDecision={finishStageWithNoteDecision}
              onSkipDraft={skipDraft}
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
          sourcePreview={sourcePreview}
          previewBusy={previewBusy}
          session={session}
          busy={busy}
          selectedStageId={selectedStageId}
          onActivate={setActiveInspectorTab}
          onCloseTab={closeInspectorTab}
          onEditProfile={() => { setShowProfile(true); router.push("/profile"); }}
          onOpenSources={openSources}
          onOpenCitations={(title, citations) => openCitationInspector({ title, citations, insufficient: citations.length === 0 })}
          onOpenStage={(stageId) => {
            const target = session.plan?.stages.find((stage) => stage.id === stageId);
            void enterStage(stageId, target?.status === "pending");
          }}
        />
      )}
      {pendingNavigation && (
        <div className="note-decision-backdrop" role="presentation">
          <section className="note-decision-dialog navigation-decision-dialog" role="dialog" aria-modal="true" aria-labelledby="navigation-decision-heading">
            <AlertTriangle size={24} aria-hidden="true" />
            <h3 id="navigation-decision-heading">{pendingNavigation === "exit" ? "暂时离开这份文档？" : "确认返回上一步？"}</h3>
            <p>{pendingNavigation === "exit" ? "当前为匿名临时会话。结束精读后，本次路线、对话和未导出的笔记将被清除，且无法恢复。" : "当前为匿名临时会话。返回上一步会离开本阶段；请先确认已记录需要保留的内容。"}</p>
            <div className="note-decision-actions">
              <button className="secondary-button" type="button" disabled={busy} onClick={() => setPendingNavigation(undefined)}>继续当前阅读</button>
              <button className="danger-button" type="button" disabled={busy} onClick={() => void (pendingNavigation === "exit" ? endCurrentSession() : confirmBackNavigation())}>
                {busy ? <LoaderCircle className="spin" size={18} /> : <ArrowLeft size={17} />}
                {pendingNavigation === "exit" ? "结束并离开" : "确认返回"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function ProfileForm({
  session,
  busy,
  onSubmit,
  onCancel,
}: {
  session: SessionView;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
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
        <div className="profile-actions">
          {session.plan && <button className="secondary-button" type="button" disabled={busy} onClick={onCancel}>放弃修改</button>}
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={18} /> : <Layers3 size={18} />}
            {session.plan ? "重新生成路线" : "生成阅读路线"}
          </button>
        </div>
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
  onEditProfile,
  onExit,
  onComplete,
  onOpenSources,
  onOpenMessageCitations,
  onEnterStage,
  onStageAction,
  onGenerateDraft,
  onFinishWithNoteDecision,
  onSkipDraft,
  onResolveDraft,
}: {
  session: SessionView;
  busy: boolean;
  selectedStageId?: string;
  streamingText: string;
  stageOpen: boolean;
  onEditProfile: () => void;
  onExit: () => void;
  onComplete: () => void;
  onOpenSources: (stageId: string, title: string) => void;
  onOpenMessageCitations: (title: string, citations: Citation[]) => void;
  onEnterStage: (stageId: string, start?: boolean) => Promise<void>;
  onStageAction: (
    stageId: string,
    action: "start" | "follow_up" | "rephrase" | "answer_check" | "finish",
    message?: string,
  ) => Promise<boolean>;
  onGenerateDraft: (stageId: string) => Promise<boolean>;
  onFinishWithNoteDecision: (stageId: string, decision: "generate" | "skip") => Promise<boolean>;
  onSkipDraft: (stageId: string) => Promise<boolean>;
  onResolveDraft: (
    stageId: string,
    draftId: string,
    action: "accept" | "skip",
    editedContent?: string,
  ) => Promise<boolean>;
}) {
  const plan = session.plan!;
  const selectedStage = plan.stages.find((stage) => stage.id === selectedStageId);

  function openStage(stageId: string, start = false) {
    void onEnterStage(stageId, start);
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
  const allCompleted = plan.stages.length > 0 && plan.stages.every((stage) => stage.status === "completed");
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
          {!allCompleted && (
            <div className="route-exit-row">
              <button className="quiet-exit-button" type="button" onClick={onExit}>暂时离开</button>
            </div>
          )}
          {allCompleted && (
            <section className="completion-card" aria-label="阅读路线已完成">
              <CheckCircle2 size={22} />
              <div><strong>本次精读路线已完成</strong><p>阶段笔记已整理完成，可以开始下一份技术文档。</p></div>
              <button className="primary-button" type="button" onClick={onComplete}>学学别的</button>
            </section>
          )}
        </>
      ) : (
        <section className="reading-workbench-shell" aria-label="阶段精读工作台">
          {selectedStage && (
            <StageWorkspace
              stage={selectedStage}
              busy={busy}
              streamingText={streamingText}
              onAction={onStageAction}
              onOpenCitations={onOpenMessageCitations}
              note={session.notes.find((item) => item.stageId === selectedStage.id)}
              onGenerateDraft={onGenerateDraft}
              onFinishWithNoteDecision={onFinishWithNoteDecision}
              onSkipDraft={onSkipDraft}
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
  onFinishWithNoteDecision,
  onSkipDraft,
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
  onFinishWithNoteDecision: (stageId: string, decision: "generate" | "skip") => Promise<boolean>;
  onSkipDraft: (stageId: string) => Promise<boolean>;
  onResolveDraft: (
    stageId: string,
    draftId: string,
    action: "accept" | "skip",
    editedContent?: string,
  ) => Promise<boolean>;
}) {
  const [input, setInput] = useState("");
  const [noteDecisionOpen, setNoteDecisionOpen] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  async function submit(action: "follow_up" | "answer_check") {
    const value = input.trim();
    if (!value) return;
    if (await onAction(stage.id, action, value)) setInput("");
  }

  async function resolveNoteDecision(decision: "generate" | "skip") {
    if (await onFinishWithNoteDecision(stage.id, decision)) setNoteDecisionOpen(false);
  }

  return (
    <section className="stage-workspace" aria-labelledby="active-stage-heading">
      <h2 id="active-stage-heading" className="sr-only">{stage.title}</h2>

      {stage.status === "pending" && !streamingText && (
        <button className="primary-button" type="button" disabled={busy} onClick={() => void onAction(stage.id, "start")}>
          {busy ? <LoaderCircle className="spin" size={18} /> : <ChevronRight size={18} />}
          开始本阶段
        </button>
      )}

      {stage.status !== "awaiting_note" && !(stage.status === "completed" && note) && <div ref={messagesRef} className="message-list" aria-live="polite">
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
      </div>}

      {stage.status === "active" && !busy && (
        <div className="stage-controls">
          <button className="scroll-bottom-button" type="button" title="跳到最新内容" aria-label="跳到最新内容" onClick={() => messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" })}>
            <ArrowDown size={18} />
          </button>
          <div className="composer-box">
            <textarea
              value={input}
              maxLength={2_000}
              rows={3}
              onChange={(event) => setInput(event.target.value)}
              placeholder="输入追问，继续和精读助手讨论…"
              aria-label="输入追问"
            />
            <div className="composer-actions">
              <button className="composer-next" type="button" onClick={() => setNoteDecisionOpen(true)}>
                下一阶段
              </button>
              <button className="composer-send" type="button" disabled={!input.trim()} onClick={() => void submit("follow_up")} aria-label="发送追问" title="发送追问">
                <ArrowUp size={18} />
                <span>追问</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {stage.status === "awaiting_note" && !note && (
        <div className="awaiting-note note-recovery">
          <NotebookPen size={18} />
          <span>笔记生成未完成，请重试生成或跳过本阶段笔记。</span>
          <button className="secondary-button" type="button" disabled={busy} onClick={() => void onGenerateDraft(stage.id)}>重试生成</button>
          <button className="secondary-button" type="button" disabled={busy} onClick={() => void onSkipDraft(stage.id)}>跳过笔记</button>
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

      {noteDecisionOpen && (
        <div className="note-decision-backdrop" role="presentation">
          <section className="note-decision-dialog" role="dialog" aria-modal="true" aria-labelledby="note-decision-heading">
            <NotebookPen size={24} aria-hidden="true" />
            <h3 id="note-decision-heading">是否需要生成笔记？</h3>
            <p>生成后可编辑并确认；跳过则直接完成本阶段，且不会写入最终 Markdown 笔记。</p>
            <div className="note-decision-actions">
              <button className="secondary-button" type="button" disabled={busy} onClick={() => void resolveNoteDecision("skip")}>跳过</button>
              <button className="primary-button" type="button" disabled={busy} onClick={() => void resolveNoteDecision("generate")}>
                {busy ? <LoaderCircle className="spin" size={18} /> : <NotebookPen size={17} />}
                生成
              </button>
            </div>
          </section>
        </div>
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
  sourcePreview,
  previewBusy,
  session,
  busy,
  selectedStageId,
  onActivate,
  onCloseTab,
  onEditProfile,
  onOpenSources,
  onOpenStage,
  onOpenCitations,
}: {
  tabs: InspectorTab[];
  activeTab: InspectorTab;
  citationValue?: CitationInspector;
  sourcePreview?: SourcePreview;
  previewBusy: boolean;
  session: SessionView;
  busy: boolean;
  selectedStageId?: string;
  onActivate: (tab: InspectorTab) => void;
  onCloseTab: (tab: InspectorTab) => void;
  onEditProfile: () => void;
  onOpenSources: (stageId: string, title: string) => void;
  onOpenStage: (stageId: string) => void;
  onOpenCitations: (title: string, citations: Citation[]) => void;
}) {
  const plan = session.plan!;
  return (
    <aside className="inspector-panel" aria-label="阅读导航和来源检查器">
      <div className="inspector-tabs" role="tablist" aria-label="检查器标签">
        {tabs.map((tab) => {
          const label = tab === "source" ? "原文预览" : tab === "map" ? "文档地图" : tab === "conversation" ? "精读记录" : citationValue?.title ?? "来源引用";
          return (
            <div key={tab} className={`inspector-tab${activeTab === tab ? " active" : ""}`}>
              <button type="button" role="tab" aria-selected={activeTab === tab} onClick={() => onActivate(tab)}>{tab === "source" ? <FileText size={15} /> : tab === "map" ? <Layers3 size={15} /> : <Search size={15} />}<span>{label}</span></button>
              {tab === "citations" && <button className="inspector-tab-close" type="button" title={`关闭${label}`} aria-label={`关闭${label}`} onClick={() => onCloseTab(tab)}><X size={14} /></button>}
            </div>
          );
        })}
      </div>
      <div className="inspector-content">
        {activeTab === "source" && tabs.includes("source") && (
          <section className="source-preview" aria-label="原文预览">
            {previewBusy && <p className="inspector-loading">正在整理可预览的原文文本…</p>}
            {!previewBusy && sourcePreview && (<>
              <p className="source-preview-note">以下为已解析的原文文本预览；PDF 的原始排版、图片和批注不在首版范围内。</p>
              {sourcePreview.outline.length > 0 && <nav className="source-preview-outline" aria-label="文档章节">{sourcePreview.outline.map((item) => <span key={item}>{item}</span>)}</nav>}
              <div className="source-preview-chunks">
                {sourcePreview.chunks.map((chunk) => <article key={chunk.id}><div><span>{chunk.id}</span><small>{chunk.headingPath.at(-1) ?? (chunk.page ? `第 ${chunk.page} 页` : "正文")}</small></div><p>{chunk.text}</p></article>)}
              </div>
            </>)}
          </section>
        )}
        {activeTab === "map" && tabs.includes("map") && (
          <>
            <DocumentMapPanel plan={plan} session={session} onEditProfile={onEditProfile} onExport={() => undefined} canExport={session.notes.some((note) => note.status === "accepted")} />
            <RouteSection plan={plan} session={session} busy={busy} selectedStageId={selectedStageId} onOpenSources={onOpenSources} onSelectStage={onOpenStage} />
          </>
        )}
        {activeTab === "conversation" && tabs.includes("conversation") && (
          <ConversationInspector session={session} selectedStageId={selectedStageId} onOpenCitations={onOpenCitations} />
        )}
        {activeTab === "citations" && tabs.includes("citations") && (
          <>
            {citationValue?.insufficient ? <div className="drawer-empty">文档中未找到足够依据</div> : <ol className="citation-list">{citationValue?.citations.map((citation) => <li key={citation.chunkId}><div><span>{citation.chunkId}</span><strong>{citation.label}</strong></div><p>{citation.excerpt}</p></li>)}</ol>}
          </>
        )}
      </div>
    </aside>
  );
}

function ConversationInspector({
  session,
  selectedStageId,
  onOpenCitations,
}: {
  session: SessionView;
  selectedStageId?: string;
  onOpenCitations: (title: string, citations: Citation[]) => void;
}) {
  const stages = session.plan?.stages ?? [];
  const selected = stages.find((stage) => stage.id === selectedStageId);
  const visibleStages = selected ? [selected] : stages.filter((stage) => stage.messages.length > 0);
  if (!visibleStages.length) return <div className="drawer-empty">当前还没有精读对话记录</div>;
  return (
    <div className="conversation-inspector">
      {visibleStages.map((stage) => (
        <section key={stage.id} className="conversation-stage">
          <div className="conversation-stage-heading"><span>{stage.id}</span><strong>{stage.title}</strong></div>
          <div className="conversation-messages">
            {stage.messages.map((message) => (
              <article key={message.id} className={`reading-message ${message.role}`}>
                <span className="message-role">{message.role === "assistant" ? "精读助手" : "你"}</span>
                {message.role === "assistant" ? (
                  <MarkdownMessage content={message.content} citations={message.citations} onOpenCitations={onOpenCitations} title={stage.title} />
                ) : <div className="user-bubble">{message.content}</div>}
                {message.citations.length > 0 && <button className="citation-button" type="button" onClick={() => onOpenCitations(stage.title, message.citations)}><Search size={14} /> {message.citations.length} 条来源</button>}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
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
