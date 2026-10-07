import { env } from "../../config/env.js";
import { answerSourceTag } from "../../lib/cache-keys.js";

const TAG_TTL_MS = 5 * 60 * 1000;
const memo = new Map();

const getJson = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const remembered = async (name, load) => {
  const hit = memo.get(name);
  if (hit && Date.now() - hit.at < TAG_TTL_MS) return hit.tag;
  const tag = await load();
  memo.set(name, { tag, at: Date.now() });
  return tag;
};

const base = (url) => url?.replace(/\/$/, "");

export const classifierTag = () =>
  remembered("classifier", async () => {
    if (!env.RAG_SERVICE_URL) return null;
    const health = await getJson(`${base(env.RAG_SERVICE_URL)}/health`);
    return answerSourceTag([health?.model, health?.embedding_model, health?.synonyms]);
  });

export const regulatoryTag = () =>
  remembered("regulatory", async () => {
    if (!env.REGULATORY_RAG_URL) return null;
    const [health, library] = await Promise.all([
      getJson(`${base(env.REGULATORY_RAG_URL)}/health`),
      getJson(`${base(env.REGULATORY_RAG_URL)}/sources`),
    ]);
    const model = health?.services?.find((service) => service.service === "ollama")?.model;
    const sources = (library?.sources || [])
      .filter((source) => source.ingested)
      .map((source) => `${source.title}:${source.passages}`)
      .sort();
    return sources.length ? answerSourceTag([model, sources.join("|")]) : null;
  });

export const resetAnswerTags = () => memo.clear();
