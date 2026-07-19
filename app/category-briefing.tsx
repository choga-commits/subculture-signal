"use client";

import { useEffect, useMemo, useState } from "react";
import { archiveDates, briefItems, briefingMeta, signals } from "./data";

const categoryClass: Record<string, string> = {
  "AI 캐릭터": "tag-ai",
  웹툰: "tag-webtoon",
  웹소설: "tag-novel",
  만화: "tag-manga",
  애니메이션: "tag-anime",
};

const groups = [
  {
    id: "webtoon-novel",
    number: "01",
    title: "웹툰 / 웹소설",
    eyebrow: "STORY IP",
    description: "연재에서 영상화까지, 이야기 IP의 확장과 유통을 읽습니다.",
    categories: ["웹툰", "웹소설"],
  },
  {
    id: "animation-manga",
    number: "02",
    title: "애니메이션 / 만화",
    eyebrow: "VISUAL CONTENT",
    description: "제작·편성·출판을 가로지르는 글로벌 콘텐츠 흐름을 살핍니다.",
    categories: ["애니메이션", "만화"],
  },
  {
    id: "ai-character-chatbot",
    number: "03",
    title: "AI 캐릭터 챗봇",
    eyebrow: "INTERACTIVE CHARACTER",
    description: "대화형 캐릭터와 팬 경험이 만드는 새로운 시장을 추적합니다.",
    categories: ["AI 캐릭터"],
  },
] as const;

type GroupId = (typeof groups)[number]["id"];

function formatDate(value: string) {
  return value.replaceAll("-", ".");
}

function formatArchiveRange(value: string) {
  const end = new Date(`${value}T00:00:00+09:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - 1);
  const compact = (date: Date) => `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
  return `${compact(start)} 09:00 — ${compact(end)} 08:59 KST`;
}

export default function CategoryBriefing() {
  const [selectedGroup, setSelectedGroup] = useState<GroupId | null>(null);

  useEffect(() => {
    const syncWithHash = () => {
      const id = window.location.hash.slice(1) as GroupId;
      setSelectedGroup(groups.some((group) => group.id === id) ? id : null);
    };
    syncWithHash();
    window.addEventListener("hashchange", syncWithHash);
    return () => window.removeEventListener("hashchange", syncWithHash);
  }, []);

  const activeGroup = groups.find((group) => group.id === selectedGroup) ?? null;
  const dateGroups = useMemo(() => {
    if (!activeGroup) return [];
    const items = briefItems
      .filter((item) => (activeGroup.categories as readonly string[]).includes(item.category))
      .toSorted((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    return archiveDates.map((date) => ({
      date,
      items: items.filter((item) => item.archivedAt === date),
    }));
  }, [activeGroup]);

  const openGroup = (id: GroupId) => {
    window.history.pushState(null, "", `#${id}`);
    setSelectedGroup(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const showLanding = () => {
    window.history.pushState(null, "", window.location.pathname + window.location.search);
    setSelectedGroup(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main id="top">
      <header className="site-header">
        <button className="wordmark wordmark-button" onClick={showLanding} aria-label="카테고리 첫 화면으로 이동">
          <span className="wordmark-dot" />
          SUBCULTURE SIGNAL
        </button>
        <div className="header-meta">
          <span>SEOUL / KST</span>
          <span className="live"><i /> DAILY 09:00</span>
        </div>
      </header>

      {!activeGroup ? (
        <>
          <section className="category-landing" aria-labelledby="category-title">
            <div className="category-intro">
              <div className="hero-kicker">ISSUE {String(briefingMeta.issueNumber).padStart(3, "0")} · {briefingMeta.publishedLabel}</div>
              <h1 id="category-title">오늘, 어떤<br /><em>산업의 신호</em>를<br />읽을까요?</h1>
              <p>{briefingMeta.intro}</p>
            </div>
            <div className="category-grid" aria-label="브리핑 카테고리">
              {groups.map((group) => {
                const count = briefItems.filter((item) => (group.categories as readonly string[]).includes(item.category)).length;
                return (
                  <button className={`category-card category-card-${group.number}`} onClick={() => openGroup(group.id)} key={group.id}>
                    <span className="category-number">{group.number}</span>
                    <span className="category-eyebrow">{group.eyebrow}</span>
                    <strong>{group.title}</strong>
                    <span className="category-description">{group.description}</span>
                    <span className="category-card-footer"><b>{count} STORIES</b><i aria-hidden="true">→</i></span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="signal-section" aria-labelledby="signal-title">
            <div className="section-heading light"><p>SIGNAL RADAR</p><h2 id="signal-title">지금 커지는 흐름</h2></div>
            <div className="signal-list">
              {signals.map((signal, index) => (
                <div className="signal-row" key={signal.title}>
                  <span>0{index + 1}</span>
                  <div><h3>{signal.title}</h3><p>{signal.description}</p></div>
                  <div className="meter" aria-label={`신호 강도 ${signal.level}점`}>
                    {Array.from({ length: 5 }).map((_, i) => <i className={i < signal.level ? "on" : ""} key={i} />)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="category-detail" aria-labelledby="detail-title">
          <button className="back-button" onClick={showLanding}>← 카테고리로 돌아가기</button>
          <div className="detail-header">
            <div>
              <p>{activeGroup.eyebrow} · DAILY INTELLIGENCE</p>
              <h1 id="detail-title">{activeGroup.title}</h1>
              <span>{activeGroup.description}</span>
            </div>
            <strong>{dateGroups.reduce((sum, group) => sum + group.items.length, 0)} STORIES<br /><small>VERIFIED LINKS</small></strong>
          </div>

          <nav className="category-switcher" aria-label="다른 카테고리 보기">
            {groups.map((group) => (
              <button className={group.id === activeGroup.id ? "active" : ""} onClick={() => openGroup(group.id)} key={group.id}>{group.title}</button>
            ))}
          </nav>

          <div className="dated-briefings">
            {dateGroups.map((dateGroup) => (
              <section className="date-group" aria-labelledby={`date-${dateGroup.date}`} key={dateGroup.date}>
                <div className="date-heading">
                  <div><span>ARCHIVED ON</span><time id={`date-${dateGroup.date}`}>{formatDate(dateGroup.date)}</time></div>
                  <div className="archive-meta"><span>{dateGroup.items.length} STORIES</span><small>수집 범위 {formatArchiveRange(dateGroup.date)}</small></div>
                </div>
                {dateGroup.items.length > 0 ? (
                  <div className="card-grid">
                    {dateGroup.items.map((item) => (
                      <article className="story-card" key={item.title}>
                        <div className="card-topline"><span className={`category-tag ${categoryClass[item.category]}`}>{item.category}</span><time>원문 {formatDate(item.publishedAt)}</time></div>
                        <h3>{item.title}</h3>
                        <p className="summary">{item.summary}</p>
                        <div className="why-box"><span>WHY IT MATTERS</span><p>{item.why}</p></div>
                        <div className="skill-line"><span>채용 키워드</span><div>{item.skills.map((skill) => <b key={skill}>#{skill}</b>)}</div></div>
                        <a className="source-link" href={item.url} target="_blank" rel="noreferrer">원문 확인 <span aria-hidden="true">↗</span></a>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="card-grid">
                    <article className="story-card">
                      <div className="card-topline"><span className="category-tag">없음</span><time>원문 없음</time></div>
                      <h3>주요 신규 신호 없음</h3>
                      <p className="summary">정책 기준 조사 범위 안에서 이 카테고리에 해당하는 새 적격 자료를 확인하지 못했습니다.</p>
                      <div className="why-box"><span>WHY IT MATTERS</span><p>빈 회차도 날짜 단위로 보존해 누락과 공백을 구분합니다.</p></div>
                      <div className="skill-line"><span>채용 키워드</span><div><b>#모니터링</b><b>#자료조사</b></div></div>
                    </article>
                  </div>
                )}
              </section>
            ))}
          </div>
        </section>
      )}

      <footer>
        <div><span className="wordmark-dot" /><strong>SUBCULTURE SIGNAL</strong></div>
        <p>매일 오전 9시 KST 업데이트 · 공개 자료를 요약하며, 중요한 판단은 원문 확인을 권장합니다.</p>
        <button onClick={showLanding}>CATEGORY HOME ↑</button>
      </footer>
    </main>
  );
}
