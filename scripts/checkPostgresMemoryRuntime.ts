import { runSeptonWithPostgresMemory } from "../packages/shared/src/services/septonRuntimePostgres";

const question =
  "Why did sales in the U.S. decline last week, and what should we do to prevent this from happening in the future or for the next promotion in August?";

const run = await runSeptonWithPostgresMemory(question, "root_cause_analysis", undefined, {
  connectionString: process.env.DATABASE_URL,
  database: process.env.DATABASE_URL ? undefined : "septon_memory",
});

console.log("Curated memory runtime check");
console.log(`Raw records: ${run.knowledgeBase.records.length}`);
console.log(`Entities: ${run.knowledgeBase.nodes.length}`);
console.log(`Relationships: ${run.knowledgeBase.edges.length}`);
console.log(`Documents: ${run.knowledgeBase.documents.length}`);
console.log(`Context hits: ${run.contextBundle.vectorHits.length}`);
console.log(`Recommendation: ${run.recommendation.headline}`);
