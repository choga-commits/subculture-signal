import briefing from "../content/briefing.json";

type GroupId = "webtoon-novel" | "animation-manga" | "ai-character-chatbot";
type Category = "웹툰" | "웹소설" | "애니메이션" | "만화" | "AI 캐릭터";

type BriefingMeta = {
  issueNumber: number;
  publishedOn: string;
  publishedLabel: string;
  intro: string;
};

type Signal = {
  title: string;
  description: string;
  level: number;
};

type BriefItem = {
  group: GroupId;
  category: Category;
  publishedAt: string;
  archivedAt?: string;
  title: string;
  summary: string;
  why: string;
  skills: string[];
  url: string;
};

const data = briefing as {
  meta: BriefingMeta;
  signals: Signal[];
  items: BriefItem[];
};

export const briefingMeta = data.meta;
export const signals = data.signals;
export const briefItems = data.items.map((item) => ({ ...item, archivedAt: item.archivedAt ?? data.meta.publishedOn }));
