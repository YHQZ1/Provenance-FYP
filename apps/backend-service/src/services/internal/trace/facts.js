const settle = async (enabled, load) => {
  if (!enabled) return { value: null, failed: false };
  try {
    return { value: await load(), failed: false };
  } catch {
    return { value: null, failed: true };
  }
};

export const gatherFacts = async ({ readers, userId, intents, fy, documentId, question }) => {
  const [filing, obligations, queue, activity, document, regulation] = await Promise.all([
    settle(intents.workspace, () => readers.filing(userId, fy)),
    settle(intents.obligations, () => readers.obligations(userId, fy)),
    settle(intents.review, () => readers.reviewQueue(userId)),
    settle(intents.activity, () => readers.activity(userId, fy)),
    settle(intents.document && documentId, () => readers.document(documentId, userId)),
    settle(intents.regulation, () => readers.regulations(question, intents.workspace ? 3 : 4)),
  ]);

  const unavailable = Object.entries({
    "the filing summary": filing,
    obligations,
    "the review queue": queue,
    activity,
    "the open document": document,
    "the regulation library": regulation,
  })
    .filter(([, result]) => result.failed)
    .map(([name]) => name);

  return {
    filing: filing.value,
    obligations: obligations.value,
    queue: queue.value,
    activity: activity.value,
    document: document.value,
    passages: regulation.value?.passages || [],
    unavailable,
  };
};
