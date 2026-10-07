const MAX_DOCUMENT_LINKS = 3;

const PAGE_LINKS = {
  review: { label: "Open Review", to: "/review" },
  obligations: { label: "Open Obligations", to: "/obligations" },
  activity: { label: "Open Activity", to: "/activity" },
};

export const buildLinks = ({ answer, documents = [], intents = {}, page }) => {
  const text = answer.toLowerCase();
  const links = documents
    .filter((document) => text.includes(document.filename.toLowerCase()))
    .slice(0, MAX_DOCUMENT_LINKS)
    .map((document) => ({ label: document.filename, to: `/documents?open=${document.id}` }));

  for (const [intent, link] of Object.entries(PAGE_LINKS)) {
    if (intents[intent] && page !== link.to) links.push(link);
  }
  if (/finali[sz]/.test(text) && page !== "/filing")
    links.push({ label: "Open Filing", to: "/filing" });
  return links;
};

export const buildSources = (passages = [], answer = "", always = false) => {
  if (!always && !/\bp\.\s*\d+/i.test(answer)) return [];
  const grouped = new Map();
  for (const passage of passages) {
    const key = passage.url || passage.source;
    const entry = grouped.get(key) || { name: passage.source, url: passage.url, pages: [] };
    if (passage.page != null && !entry.pages.includes(passage.page)) entry.pages.push(passage.page);
    grouped.set(key, entry);
  }
  return [...grouped.values()].map((entry) => ({
    ...entry,
    pages: entry.pages.sort((a, b) => a - b),
  }));
};
