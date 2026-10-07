const REGULATION =
  /\b(cpcb|rules?|guidelines?|regulat\w*|laws?|legal|penalt\w*|environmental compensation|deadlines?|due date|annual returns?|registr\w*|brsr|sebi|pibos?|epr|mandatory|requirements?|portal|recycled content|end of life|compostable|category (i|ii|iii|iv)|required to|allowed to|do i (need|have) to)\b/i;
const WORKSPACE =
  /\b(my|our|we|us|this year|fy|financial year|how (much|many)|totals?|introduced|recycled|collected|blockers?|finali[sz]\w*|filing|documents?|invoices?|certificates?|lines?|pending|approved?|shortfall|obligations?|materials?|pet|hdpe|ldpe|pp|pvc|ps|mlp|kg|tonnes?|uploaded|missing|flagged)\b/i;
const WORKSPACE_EXTRA =
  /\b[\w.-]+\.(pdf|jpe?g|png|tiff?)\b|\b(delete|remove|edit|change|upload|approve|exclude|retry|rename)\b/i;
const REVIEW =
  /\b(review|pending|waiting|approve|suggested|needs? (a )?(material|weight|review))\b/i;
const OBLIGATIONS = /\b(obligations?|shortfall|targets?|owe|compensation estimate|epr quantity)\b/i;
const ACTIVITY =
  /\b(who|activity|history|changed|deleted|uploaded|approved by|recently|last (week|month))\b/i;

const PAGE_INTENTS = {
  "/review": "review",
  "/obligations": "obligations",
  "/activity": "activity",
};

export const detectIntents = (message, context = {}) => {
  const page = context.page || "";
  const intents = {
    regulation: REGULATION.test(message) || page === "/regulatory",
    review: REVIEW.test(message) || PAGE_INTENTS[page] === "review",
    obligations: OBLIGATIONS.test(message) || PAGE_INTENTS[page] === "obligations",
    activity: ACTIVITY.test(message) || PAGE_INTENTS[page] === "activity",
    document: Boolean(context.documentId),
  };
  intents.workspace =
    WORKSPACE.test(message) ||
    WORKSPACE_EXTRA.test(message) ||
    intents.review ||
    intents.obligations ||
    intents.activity ||
    intents.document;
  if (!intents.workspace && !intents.regulation) {
    intents.workspace = page !== "/regulatory";
    intents.regulation = page === "/regulatory";
  }
  return intents;
};
