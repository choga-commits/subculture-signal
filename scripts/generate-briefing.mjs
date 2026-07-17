import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const contentPath = path.join(rootDir, "content", "briefing.json");
const docsPath = path.join(rootDir, "docs", "index.html");
const issueStartDate = "2026-07-16";
const dayLabels = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const groups = {
  "webtoon-novel": {
    title: "웹툰 / 웹소설",
    eyebrow: "STORY IP",
    description: "연재에서 영상화까지, 이야기 IP의 확장과 유통을 읽습니다.",
  },
  "animation-manga": {
    title: "애니메이션 / 만화",
    eyebrow: "VISUAL CONTENT",
    description: "제작·편성·출판을 가로지르는 글로벌 콘텐츠 흐름을 살핍니다.",
  },
  "ai-character-chatbot": {
    title: "AI 캐릭터 챗봇",
    eyebrow: "INTERACTIVE CHARACTER",
    description: "대화형 캐릭터와 팬 경험이 만드는 새로운 시장을 추적합니다.",
  },
};
const categoryClass = {
  "AI 캐릭터": "tag-ai",
  "웹툰": "tag-webtoon",
  "웹소설": "tag-novel",
  "만화": "tag-manga",
  "애니메이션": "tag-anime",
};
const validCategories = new Set(Object.keys(categoryClass));
const validGroups = new Set(Object.keys(groups));

function parseArgs(argv) {
  const args = { renderOnly: false, date: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--render-only") args.renderOnly = true;
    if (arg === "--date") args.date = argv[i + 1] ?? null;
  }
  return args;
}

function getKstDateString(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

function formatPublishedLabel(dateString) {
  const date = new Date(`${dateString}T00:00:00+09:00`);
  const yyyy = dateString.slice(0, 4);
  const mm = dateString.slice(5, 7);
  const dd = dateString.slice(8, 10);
  return `${yyyy}.${mm}.${dd} ${dayLabels[date.getUTCDay()]}`;
}

function diffDays(start, end) {
  const a = new Date(`${start}T00:00:00+09:00`).getTime();
  const b = new Date(`${end}T00:00:00+09:00`).getTime();
  return Math.round((b - a) / 86400000);
}

function issueNumberFor(dateString) {
  return diffDays(issueStartDate, dateString) + 1;
}

function json(value) {
  return JSON.stringify(value, null, 2);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function stripCodeFence(text) {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function extractOutputText(payload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const chunks = [];
  for (const item of payload.output ?? []) {
    if (item.type !== "message") continue;
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") chunks.push(content.text);
      if (content.type === "text" && typeof content.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

function normalizeItem(item) {
  return {
    group: item.group,
    category: item.category,
    publishedAt: item.publishedAt,
    title: item.title.trim(),
    summary: item.summary.trim(),
    why: item.why.trim(),
    skills: item.skills.map((skill) => skill.trim()).filter(Boolean),
    url: item.url.trim(),
  };
}

function validateBriefing(data, targetDate) {
  if (!data || typeof data !== "object") throw new Error("브리핑 데이터가 비어 있습니다.");
  if (!Array.isArray(data.items) || data.items.length < 6 || data.items.length > 10) {
    throw new Error("기사 수는 6~10건이어야 합니다.");
  }
  if (!Array.isArray(data.signals) || data.signals.length !== 3) {
    throw new Error("신호 지표는 정확히 3개여야 합니다.");
  }

  const earliest = new Date(`${targetDate}T00:00:00+09:00`);
  earliest.setDate(earliest.getDate() - 3);
  const earliestString = `${earliest.getFullYear()}-${String(earliest.getMonth() + 1).padStart(2, "0")}-${String(earliest.getDate()).padStart(2, "0")}`;

  const seenUrls = new Set();
  const normalizedItems = data.items.map(normalizeItem).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  for (const item of normalizedItems) {
    if (!validGroups.has(item.group)) throw new Error(`허용되지 않은 group: ${item.group}`);
    if (!validCategories.has(item.category)) throw new Error(`허용되지 않은 category: ${item.category}`);
    if (item.group === "webtoon-novel" && !["웹툰", "웹소설"].includes(item.category)) throw new Error("웹툰/웹소설 그룹 분류 오류");
    if (item.group === "animation-manga" && !["애니메이션", "만화"].includes(item.category)) throw new Error("애니메이션/만화 그룹 분류 오류");
    if (item.group === "ai-character-chatbot" && item.category !== "AI 캐릭터") throw new Error("AI 캐릭터 챗봇 그룹 분류 오류");
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(item.publishedAt)) throw new Error(`날짜 형식 오류: ${item.publishedAt}`);
    if (item.publishedAt > targetDate || item.publishedAt < earliestString) throw new Error(`기사 날짜 범위 오류: ${item.publishedAt}`);
    if (!/^https:\/\//.test(item.url)) throw new Error(`URL 형식 오류: ${item.url}`);
    if (seenUrls.has(item.url)) throw new Error(`중복 URL: ${item.url}`);
    seenUrls.add(item.url);
    if (item.skills.length < 2 || item.skills.length > 4) throw new Error(`skills 개수 오류: ${item.title}`);
  }

  const normalizedSignals = data.signals.map((signal) => ({
    title: signal.title.trim(),
    description: signal.description.trim(),
    level: Number(signal.level),
  }));
  for (const signal of normalizedSignals) {
    if (!Number.isInteger(signal.level) || signal.level < 1 || signal.level > 5) throw new Error(`signal level 오류: ${signal.title}`);
  }

  return {
    meta: {
      issueNumber: issueNumberFor(targetDate),
      publishedOn: targetDate,
      publishedLabel: formatPublishedLabel(targetDate),
      intro: "관심 있는 카테고리를 선택하면 실제 게시일 기준 최신 기사부터 날짜별로 볼 수 있습니다.",
    },
    signals: normalizedSignals,
    items: normalizedItems,
  };
}

function articleHtml(item) {
  return `<article class="story-card" data-group="${item.group}" data-date="${item.publishedAt}"><div class="card-topline"><span class="category-tag ${categoryClass[item.category]}">${escapeHtml(item.category)}</span><time>원문 ${item.publishedAt.replaceAll("-", ".")}</time></div><h3>${escapeHtml(item.title)}</h3><p class="summary">${escapeHtml(item.summary)}</p><div class="why-box"><span>WHY IT MATTERS</span><p>${escapeHtml(item.why)}</p></div><div class="skill-line"><span>채용 키워드</span><div>${item.skills.map((skill) => `<b>#${escapeHtml(skill)}</b>`).join("")}</div></div><a class="source-link" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">원문 확인 <span>↗</span></a></article>`;
}

function renderDocs(data) {
  const counts = {
    "webtoon-novel": data.items.filter((item) => item.group === "webtoon-novel").length,
    "animation-manga": data.items.filter((item) => item.group === "animation-manga").length,
    "ai-character-chatbot": data.items.filter((item) => item.group === "ai-character-chatbot").length,
  };

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="웹툰, 웹소설, 애니메이션, 만화, AI 캐릭터 챗봇 산업을 취업 준비 관점으로 읽는 데일리 브리핑">
  <title>SUBCULTURE SIGNAL</title>
  <link rel="stylesheet" href="./style.css">
  <link rel="stylesheet" href="./category.css">
</head>
<body>
<main id="top">
  <header class="site-header">
    <button class="wordmark wordmark-button" type="button" data-home><span class="wordmark-dot"></span>SUBCULTURE SIGNAL</button>
    <div class="header-meta"><span>SEOUL / KST</span><span class="live"><i></i> DAILY 09:00</span></div>
  </header>

  <div id="landing-view">
    <section class="category-landing" aria-labelledby="category-title">
      <div class="category-intro">
        <div class="hero-kicker">ISSUE ${String(data.meta.issueNumber).padStart(3, "0")} · ${data.meta.publishedLabel}</div>
        <h1 id="category-title">오늘, 어떤<br><em>산업의 신호</em>를<br>읽을까요?</h1>
        <p>${escapeHtml(data.meta.intro)}</p>
      </div>
      <div class="category-grid" aria-label="브리핑 카테고리">
        <button class="category-card category-card-01" type="button" data-group="webtoon-novel">
          <span class="category-number">01</span><span class="category-eyebrow">STORY IP</span><strong>웹툰 / 웹소설</strong>
          <span class="category-description">연재에서 영상화까지, 이야기 IP의 확장과 유통을 읽습니다.</span>
          <span class="category-card-footer"><b>${counts["webtoon-novel"]} STORIES</b><i aria-hidden="true">→</i></span>
        </button>
        <button class="category-card category-card-02" type="button" data-group="animation-manga">
          <span class="category-number">02</span><span class="category-eyebrow">VISUAL CONTENT</span><strong>애니메이션 / 만화</strong>
          <span class="category-description">제작·편성·출판을 가로지르는 글로벌 콘텐츠 흐름을 살핍니다.</span>
          <span class="category-card-footer"><b>${counts["animation-manga"]} STORIES</b><i aria-hidden="true">→</i></span>
        </button>
        <button class="category-card category-card-03" type="button" data-group="ai-character-chatbot">
          <span class="category-number">03</span><span class="category-eyebrow">INTERACTIVE CHARACTER</span><strong>AI 캐릭터 챗봇</strong>
          <span class="category-description">대화형 캐릭터와 팬 경험이 만드는 새로운 시장을 추적합니다.</span>
          <span class="category-card-footer"><b>${counts["ai-character-chatbot"]} STORIES</b><i aria-hidden="true">→</i></span>
        </button>
      </div>
    </section>

    <section class="signal-section"><div class="section-heading light"><p>SIGNAL RADAR</p><h2>지금 커지는 흐름</h2></div><div class="signal-list">${data.signals.map((signal, index) => `<div class="signal-row"><span>0${index + 1}</span><div><h3>${escapeHtml(signal.title)}</h3><p>${escapeHtml(signal.description)}</p></div><div class="meter">${Array.from({ length: 5 }).map((_, i) => `<i${i < signal.level ? ' class="on"' : ""}></i>`).join("")}</div></div>`).join("")}</div></section>
  </div>

  <section class="category-detail" id="detail-view" aria-labelledby="detail-title" hidden>
    <button class="back-button" type="button" data-home>← 카테고리로 돌아가기</button>
    <div class="detail-header"><div><p id="detail-eyebrow"></p><h1 id="detail-title"></h1><span id="detail-description"></span></div><strong id="detail-count"></strong></div>
    <nav class="category-switcher" aria-label="다른 카테고리 보기">
      <button type="button" data-group="webtoon-novel">웹툰 / 웹소설</button>
      <button type="button" data-group="animation-manga">애니메이션 / 만화</button>
      <button type="button" data-group="ai-character-chatbot">AI 캐릭터 챗봇</button>
    </nav>
    <div class="dated-briefings" id="dated-briefings"></div>
  </section>

  <div id="article-store" hidden>
    ${data.items.map(articleHtml).join("\n    ")}
  </div>

  <footer><div><span class="wordmark-dot"></span><strong>SUBCULTURE SIGNAL</strong></div><p>매일 오전 9시 KST 업데이트 · 공개 자료를 요약하며, 중요한 판단은 원문 확인을 권장합니다.</p><button type="button" data-home>CATEGORY HOME ↑</button></footer>
</main>

<script>
  const groups = {
    "webtoon-novel": { title: "웹툰 / 웹소설", eyebrow: "STORY IP · DAILY INTELLIGENCE", description: "연재에서 영상화까지, 이야기 IP의 확장과 유통을 읽습니다." },
    "animation-manga": { title: "애니메이션 / 만화", eyebrow: "VISUAL CONTENT · DAILY INTELLIGENCE", description: "제작·편성·출판을 가로지르는 글로벌 콘텐츠 흐름을 살핍니다." },
    "ai-character-chatbot": { title: "AI 캐릭터 챗봇", eyebrow: "INTERACTIVE CHARACTER · DAILY INTELLIGENCE", description: "대화형 캐릭터와 팬 경험이 만드는 새로운 시장을 추적합니다." }
  };
  const landing = document.getElementById("landing-view");
  const detail = document.getElementById("detail-view");
  const datedBriefings = document.getElementById("dated-briefings");

  function showGroup(id, updateHash = true) {
    const group = groups[id];
    if (!group) return showHome(false);
    const articles = [...document.querySelectorAll(`#article-store .story-card[data-group="${id}"]`)].sort((a, b) => b.dataset.date.localeCompare(a.dataset.date));
    document.getElementById("detail-eyebrow").textContent = group.eyebrow;
    document.getElementById("detail-title").textContent = group.title;
    document.getElementById("detail-description").textContent = group.description;
    document.getElementById("detail-count").innerHTML = `${articles.length} STORIES<br><small>VERIFIED LINKS</small>`;
    document.querySelectorAll(".category-switcher button").forEach(button => button.classList.toggle("active", button.dataset.group === id));
    datedBriefings.replaceChildren();

    [...new Set(articles.map(article => article.dataset.date))].forEach(date => {
      const dateArticles = articles.filter(article => article.dataset.date === date);
      const section = document.createElement("section");
      section.className = "date-group";
      const heading = document.createElement("div");
      heading.className = "date-heading";
      heading.innerHTML = `<div><span>PUBLISHED ON</span><time>${date.replaceAll("-", ".")}</time></div><div class="archive-meta"><span>${dateArticles.length} STORIES</span><small>실제 게시일 기준 최신순</small></div>`;
      const grid = document.createElement("div");
      grid.className = "card-grid";
      dateArticles.forEach(article => {
        grid.append(article.cloneNode(true));
      });
      section.append(heading, grid);
      datedBriefings.append(section);
    });

    landing.hidden = true;
    detail.hidden = false;
    if (updateHash) location.hash = id;
    scrollTo({ top: 0, behavior: "smooth" });
  }

  function showHome(updateHash = true) {
    landing.hidden = false;
    detail.hidden = true;
    if (updateHash) history.pushState(null, "", location.pathname + location.search);
    scrollTo({ top: 0, behavior: "smooth" });
  }

  document.querySelectorAll("[data-group]").forEach(button => button.addEventListener("click", () => showGroup(button.dataset.group)));
  document.querySelectorAll("[data-home]").forEach(button => button.addEventListener("click", () => showHome()));
  addEventListener("hashchange", () => location.hash ? showGroup(location.hash.slice(1), false) : showHome(false));
  if (location.hash) showGroup(location.hash.slice(1), false);
</script>
</body>
</html>
`;
}

async function fetchBriefingFromOpenAI(targetDate) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY 환경 변수가 필요합니다.");

  const prompt = [
    `Today is ${targetDate} in Asia/Seoul.`,
    "Search the public web and prepare a Korean morning briefing called SUBCULTURE SIGNAL.",
    "Scope: subculture industry updates from the last 24 to 72 hours only.",
    "Coverage focus: webtoon, web novel, AI character chatbot, manga, animation.",
    "Prioritize official announcements, company press releases, public institutions, and reliable trade publications.",
    "Verify the actual published date and direct source URL for every item.",
    "Exclude duplicates, thin promotional copy, rumor, reposts, and any item with uncertain sourcing.",
    "Return 6 to 10 items total and exactly 3 signal bullets.",
    "Every item must be categorized using one exact group/category pair:",
    '- group "webtoon-novel" with category "웹툰" or "웹소설"',
    '- group "animation-manga" with category "애니메이션" or "만화"',
    '- group "ai-character-chatbot" with category "AI 캐릭터"',
    "Use YYYY-MM-DD for publishedAt.",
    "Write concise Korean summaries and why-it-matters notes for job seekers.",
    "skills must contain 2 to 4 short Korean keywords without # prefixes.",
    "Return valid JSON only, no markdown fences, with this shape:",
    json({
      signals: [{ title: "string", description: "string", level: 4 }],
      items: [{
        group: "webtoon-novel",
        category: "웹툰",
        publishedAt: targetDate,
        title: "string",
        summary: "string",
        why: "string",
        skills: ["string", "string", "string"],
        url: "https://example.com"
      }],
    }),
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5.6-terra",
      reasoning: { effort: "medium" },
      tools: [{ type: "web_search" }],
      max_output_tokens: 12000,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: "You are a meticulous industry editor. You verify dates, avoid speculation, and obey output schemas exactly." }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: prompt }],
        },
      ],
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`OpenAI API 요청 실패: ${response.status} ${JSON.stringify(payload)}`);
  }

  const text = stripCodeFence(extractOutputText(payload));
  if (!text) throw new Error("OpenAI 응답에서 텍스트를 찾지 못했습니다.");
  return JSON.parse(text);
}

async function loadBriefing() {
  return JSON.parse(await readFile(contentPath, "utf8"));
}

async function saveBriefing(data) {
  await mkdir(path.dirname(contentPath), { recursive: true });
  await writeFile(contentPath, `${json(data)}\n`, "utf8");
}

async function saveDocs(data) {
  await writeFile(docsPath, `${renderDocs(data)}\n`, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const targetDate = args.date ?? getKstDateString();

  if (args.renderOnly) {
    const existing = await loadBriefing();
    await saveDocs(existing);
    return;
  }

  const generated = await fetchBriefingFromOpenAI(targetDate);
  const validated = validateBriefing(generated, targetDate);
  await saveBriefing(validated);
  await saveDocs(validated);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
