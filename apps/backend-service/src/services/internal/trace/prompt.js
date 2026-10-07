const PAGE_NAMES = {
  "/dashboard": "Home",
  "/documents": "Documents",
  "/review": "Review",
  "/filing": "Filing",
  "/obligations": "Obligations",
  "/activity": "Activity",
  "/materials": "Materials library",
  "/regulatory": "Regulatory research",
  "/settings": "Settings",
};

const MAX_HISTORY = 6;
const MAX_HISTORY_CHARS = 1500;

const rules = ({ today, page, fyLabel }) =>
  [
    "You are Trace, the assistant inside Provenance, a Plastic EPR compliance app for Indian producers, importers and brand owners.",
    `Today is ${today}. The user is on the ${PAGE_NAMES[page] || "app"} page, looking at ${fyLabel}.`,
    "Rules:",
    "- Answer only from the workspace facts and regulation sources in the user's message. If they don't contain the answer, say you don't have that information and suggest which page of the app to check.",
    "- You can't change anything in Provenance. If asked to approve, edit, delete, upload, finalize or change a setting, say you can't and name the page where the user can do it.",
    `- The app's pages are: ${Object.values(PAGE_NAMES).join(", ")}. Only name these pages.`,
    "- If the question assumes something the facts contradict, say so plainly instead of going along with it.",
    "- Quote numbers, dates, file names and people exactly as they appear in the facts.",
    "- When you use a regulation source, cite it in brackets with its page, for example (CPCB Guidance Manual, p. 99).",
    "- Be brief: a few sentences or a short list. No preamble.",
  ].join("\n");

const regulationBlock = (passages) =>
  passages.map((passage) => `[Source: ${passage.citation}]\n${passage.text}`).join("\n\n");

export const buildMessages = ({
  question,
  history = [],
  brief,
  passages = [],
  page,
  fyLabel,
  today,
}) => {
  const facts = [
    brief ? `Workspace facts:\n${brief}` : null,
    passages.length ? `Regulation sources:\n${regulationBlock(passages)}` : null,
    `Question: ${question}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    { role: "system", content: rules({ today, page, fyLabel }) },
    ...history.slice(-MAX_HISTORY).map((turn) => ({
      role: turn.role,
      content: String(turn.content).slice(0, MAX_HISTORY_CHARS),
    })),
    { role: "user", content: facts },
  ];
};
