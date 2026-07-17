import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the category-first briefing home", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /SUBCULTURE SIGNAL/);
  assert.match(html, /웹툰 \/ 웹소설/);
  assert.match(html, /애니메이션 \/ 만화/);
  assert.match(html, /AI 캐릭터 챗봇/);
  assert.match(html, /DAILY 09:00/);
});

test("GitHub Pages edition keeps every article categorized and dated", async () => {
  const briefing = JSON.parse(await readFile(new URL("../content/briefing.json", import.meta.url), "utf8"));
  const html = await readFile(new URL("../docs/index.html", import.meta.url), "utf8");
  const articles = [...html.matchAll(/<article class="story-card" data-group="([^"]+)" data-date="([^"]+)" data-archive="([^"]+)"/g)];
  const allowedGroups = new Set(["webtoon-novel", "animation-manga", "ai-character-chatbot"]);

  assert.equal(articles.length, briefing.items.length);
  for (const [, group, date, archiveDate] of articles) {
    assert.ok(allowedGroups.has(group), `unexpected group: ${group}`);
    assert.match(date, /^20\d{2}-\d{2}-\d{2}$/);
    assert.match(archiveDate, /^20\d{2}-\d{2}-\d{2}$/);
  }
  assert.match(html, /id="landing-view"/);
  assert.match(html, /id="detail-view"/);
  assert.match(html, /id="dated-briefings"/);
  assert.match(html, /const archiveDates =/);
  assert.match(html, /archiveDates\.forEach/);
  assert.match(html, /ARCHIVED ON/);
  assert.match(html, /수집 범위/);
  assert.match(html, new RegExp(`ISSUE ${String(briefing.meta.issueNumber).padStart(3, "0")}`));
});
