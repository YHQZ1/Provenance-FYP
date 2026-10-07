const HOW_TO = /^(how|where)\s+(do|can|should|would)\s+(i|we)\b/i;

const REQUEST = /^(please\s+)?(can|could|would|will) you\b|^please\b|\bfor me\b/i;

const ACTIONS = [
  {
    verbs: /\b(approve|accept|confirm|exclude|correct)\b/i,
    page: { label: "Review", to: "/review" },
    task: "approve, correct or exclude lines",
    how: "Open Review, check each line against the invoice shown beside it, then approve it, edit the material or weight, or exclude it. Suggested lines can be approved together.",
  },
  {
    verbs: /\b(finali[sz]e|reopen|submit)\b/i,
    page: { label: "Filing", to: "/filing" },
    task: "finalize or reopen a year",
    how: "Open Filing for the year. Once every blocker is cleared, finalize it to freeze the signed-off numbers; reopen it there if something needs to change.",
  },
  {
    verbs: /\b(add|remove|delete)\b.*\btrade names?\b/i,
    page: { label: "Materials library", to: "/materials" },
    task: "manage trade names",
    how: "Open the Materials library and add a trade name with its material, or remove one from your list. Lines you corrected in review are suggested there too.",
  },
  {
    verbs:
      /\b(set|change|update|edit)\b.*\b(targets?|rates?|pre-consumer|supplied|obligation inputs?)\b/i,
    page: { label: "Obligations", to: "/obligations" },
    task: "change obligation inputs",
    how: "Open Obligations and use Edit on a category to enter pre-consumer waste, quantities supplied, your own targets or a compensation rate.",
  },
  {
    verbs:
      /\b(change|update|edit|set)\b.*\b(gstin|company|profile|epr registration|password|email|pibo)\b/i,
    page: { label: "Settings", to: "/settings" },
    task: "change your company profile or account",
    how: "Open Settings from your name at the bottom of the sidebar, then edit the company profile or account section and save.",
  },
  {
    verbs: /\b(delete|remove|upload|retry|reprocess|redate|rename)\b/i,
    page: { label: "Documents", to: "/documents" },
    task: "upload, retry or delete documents",
    how: "Open Documents. Add files to the upload queue and choose their type, use Retry on a failed document, or open a document and delete it.",
  },
];

const isRequest = (message) => {
  const text = message.trim();
  return (
    REQUEST.test(text) || ACTIONS.some((action) => action.verbs.test(text.split(/\s+/)[0] || ""))
  );
};

export const detectAction = (message) => {
  const howTo = HOW_TO.test(message.trim());
  if (!howTo && !isRequest(message)) return null;
  const action = ACTIONS.find((candidate) => candidate.verbs.test(message));
  if (!action) return null;
  if (howTo) {
    return { answer: action.how, link: { label: `Open ${action.page.label}`, to: action.page.to } };
  }
  return {
    answer: `I can't make changes in Provenance, so I can't do that for you. You can ${action.task} on the ${action.page.label} page.`,
    link: { label: `Open ${action.page.label}`, to: action.page.to },
  };
};
