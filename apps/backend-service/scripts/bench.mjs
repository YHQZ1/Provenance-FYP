// Times the paths the queue and cache work targets, against the running stack and live Supabase.
// Run with `make bench`. Optional: BENCH_TOKEN=<a Supabase access token> also times real API calls,
// which include the auth middleware. Each path runs RUNS times; the median and first run are shown.
import { supabaseAdmin } from "../src/config/database.js";
import { complianceService } from "../src/services/internal/compliance.service.js";
import { documentService } from "../src/services/internal/document.service.js";
import { obligationService } from "../src/services/internal/obligation.service.js";
import { storageService } from "../src/services/storage.service.js";
import { schema } from "../src/config/schema.js";
import { ragService } from "../src/services/external/rag.service.js";
import { regulatoryService } from "../src/services/external/regulatory.service.js";

const RUNS = Number(process.env.BENCH_RUNS || 3);
const API = process.env.BENCH_API || "http://localhost:3000/api";
const results = [];

const time = async (label, fn, runs = RUNS) => {
  const samples = [];
  for (let i = 0; i < runs; i += 1) {
    const start = performance.now();
    try {
      await fn();
    } catch (error) {
      results.push({ label, error: error.message });
      return;
    }
    samples.push(performance.now() - start);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  results.push({
    label,
    first: Math.round(samples[0]),
    median: Math.round(
      sorted.length % 2
        ? sorted[(sorted.length - 1) / 2]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2,
    ),
  });
};

await schema();
const { data } = await supabaseAdmin.from("documents").select("company_id, file_path").limit(1);
if (!data?.length) throw new Error("No documents to benchmark against");
const { company_id: companyId, file_path: filePath } = data[0];
const fy = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;

await time("raw Supabase: companies row", () =>
  supabaseAdmin.from("companies").select("*").eq("id", companyId).maybeSingle(),
);
await time("raw Supabase: token check", () => supabaseAdmin.auth.getUser("invalid.token.value"));
await time("filing summary", () => complianceService.getFiling(companyId, fy));
await time("obligations", () => obligationService.get(companyId, fy));
await time("documents list", () => documentService.listDocuments(companyId));
await time("signed file URL", () => storageService.getSignedUrl(filePath, 600));
// Through the backend, as the app calls them, so caching is included. The first run may be a miss.
await time("classifier, one line", () =>
  ragService.classifyItems([{ description: "PET preform 25g neck 1810", quantity: 500, unit: "kg" }]),
);
await time(
  "regulatory question",
  () =>
    regulatoryService.query(
      "How is environmental compensation calculated for a shortfall in EPR targets?",
    ),
);

if (process.env.BENCH_TOKEN) {
  const get = (path) =>
    fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${process.env.BENCH_TOKEN}` } }).then(
      (response) => {
        if (!response.ok) throw new Error(`${path} returned ${response.status}`);
        return response.json();
      },
    );
  await time("API GET /auth/me", () => get("/auth/me"));
  await time("API GET /compliance/filing", () => get(`/compliance/filing?fy=${fy}`));
  await time("API GET /documents", () => get("/documents"));
}

console.log(`\nProvenance benchmark · ${new Date().toISOString()} · ${RUNS} runs\n`);
console.log("Path".padEnd(34), "First".padStart(9), "Median".padStart(9));
for (const row of results) {
  if (row.error) console.log(row.label.padEnd(34), `  error: ${row.error}`);
  else console.log(row.label.padEnd(34), `${row.first} ms`.padStart(9), `${row.median} ms`.padStart(9));
}
process.exit(0);
