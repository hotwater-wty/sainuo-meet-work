import Link from "next/link";
import { ArrowRight, BookOpenCheck, FileSearch, Quote } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="产品导航">
        <div className="landing-brand">
          <span className="landing-mark" aria-hidden="true">L</span>
          <span><strong>Lumen</strong><small>技术文档精读</small></span>
        </div>
        <Link className="landing-nav-link" href="/home">开始体验 <ArrowRight size={15} /></Link>
      </nav>

      <section className="landing-hero" aria-labelledby="landing-title">
        <p className="landing-kicker">READ THE SOURCE · KEEP THE CONTEXT</p>
        <h1 id="landing-title">把陌生技术文档<br />读成自己的理解</h1>
        <p className="landing-description">
          Lumen 为 RFC、技术规范与架构文档建立阅读地图，按阶段讲清机制、约束与来源，
          让每一次精读都留下可核对的笔记。
        </p>
        <Link className="landing-primary" href="/home">
          立即体验 <ArrowRight size={18} />
        </Link>
        <p className="landing-note">从导入一份 PDF、Markdown、TXT 或 HTML 文档开始</p>
      </section>

      <section className="landing-points" aria-label="产品能力概览">
        <article>
          <span className="landing-point-icon"><FileSearch size={20} /></span>
          <div><strong>先建立阅读地图</strong><p>提炼范围、概念与建议路径，知道该从哪里读起。</p></div>
        </article>
        <article>
          <span className="landing-point-icon"><BookOpenCheck size={20} /></span>
          <div><strong>再逐阶段精读</strong><p>围绕机制、例外和工程约束推进，不把长文压成一句摘要。</p></div>
        </article>
        <article>
          <span className="landing-point-icon"><Quote size={20} /></span>
          <div><strong>每个结论可回溯</strong><p>来源引用始终可查，确认后的理解再沉淀为 Markdown 笔记。</p></div>
        </article>
      </section>

      <footer className="landing-footer">Lumen · 基于用户提供来源的技术文档精读助手</footer>
    </main>
  );
}
