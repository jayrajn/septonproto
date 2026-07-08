import pg from "pg";
import { capabilityRegistry } from "../packages/shared/src/services/capabilityRegistry";
import { syncEnterpriseConnectors } from "../packages/shared/src/services/connectors";
import { buildKnowledgeBase } from "../packages/shared/src/services/knowledgeProcessing";

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  database: process.env.DATABASE_URL ? undefined : "septon_memory",
});

async function seed() {
  const { records, batches } = syncEnterpriseConnectors();
  const knowledgeBase = buildKnowledgeBase(records);
  const rawRecordIds = new Map<string, string>();
  const entityIds = new Map<string, string>();

  await client.connect();

  try {
    await client.query("BEGIN");
    await client.query(`
      TRUNCATE
        decision_evidence_packages,
        decision_patterns,
        context_retrieval_hints,
        retrieval_configs,
        memory_documents,
        memory_relationships,
        memory_entities,
        raw_records,
        ingestion_batches
      RESTART IDENTITY CASCADE
    `);

    const batchIds = new Map<string, string>();

    for (const batch of batches) {
      const result = await client.query<{ id: string }>(
        `
          INSERT INTO ingestion_batches (
            external_batch_id,
            source,
            pattern,
            file_name,
            received_at,
            attempted_record_count,
            accepted_record_count,
            rejected_record_count,
            status,
            validation_issues,
            updates_production_context
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
          RETURNING id
        `,
        [
          batch.id,
          batch.source,
          batch.pattern,
          batch.fileName,
          batch.receivedAt,
          batch.attemptedRecordCount,
          batch.acceptedRecordCount,
          batch.rejectedRecordCount,
          batch.status,
          JSON.stringify(batch.validationIssues),
          batch.updatesProductionContext,
        ],
      );

      batchIds.set(batch.id, result.rows[0].id);
    }

    for (const record of records) {
      const batch = batches.find((candidate) => candidate.source === record.source);
      if (!batch) continue;

      const result = await client.query<{ id: string }>(
        `
          INSERT INTO raw_records (
            source_record_id,
            batch_id,
            source,
            type,
            title,
            region,
            market,
            city,
            week,
            business_unit,
            access_tags,
            required_roles,
            payload,
            body_text
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14)
          RETURNING id
        `,
        [
          record.id,
          batchIds.get(batch.id),
          record.source,
          record.type,
          record.title,
          record.region,
          record.market ?? null,
          record.city ?? null,
          record.week ?? null,
          record.businessUnit ?? null,
          record.accessTags ?? [],
          record.requiredRoles ?? [],
          JSON.stringify(record.payload),
          record.text,
        ],
      );

      rawRecordIds.set(record.id, result.rows[0].id);
    }

    for (const node of knowledgeBase.nodes) {
      const sourceRecordId = sourceRecordIdFromNodeId(node.id);
      const result = await client.query<{ id: string }>(
        `
          INSERT INTO memory_entities (
            stable_key,
            label,
            type,
            source_record_id,
            properties
          )
          VALUES ($1, $2, $3, $4, $5::jsonb)
          RETURNING id
        `,
        [node.id, node.label, node.type, sourceRecordId ? rawRecordIds.get(sourceRecordId) ?? null : null, JSON.stringify(node.properties)],
      );

      entityIds.set(node.id, result.rows[0].id);
    }

    for (const edge of knowledgeBase.edges) {
      const fromEntityId = entityIds.get(edge.from);
      const toEntityId = entityIds.get(edge.to);
      if (!fromEntityId || !toEntityId) continue;

      const sourceRecordId = sourceRecordIdFromNodeId(edge.from) ?? sourceRecordIdFromNodeId(edge.to);

      await client.query(
        `
          INSERT INTO memory_relationships (
            from_entity_id,
            to_entity_id,
            relationship_type,
            weight,
            source_record_id,
            properties
          )
          VALUES ($1, $2, $3, $4, $5, '{}'::jsonb)
          ON CONFLICT (from_entity_id, to_entity_id, relationship_type, source_record_id) DO NOTHING
        `,
        [fromEntityId, toEntityId, edge.label, edge.weight, sourceRecordId ? rawRecordIds.get(sourceRecordId) ?? null : null],
      );
    }

    for (const document of knowledgeBase.documents) {
      const rawRecordId = rawRecordIds.get(document.sourceRecordId);
      if (!rawRecordId) continue;
      const extraction = knowledgeBase.extractions.find((item) => item.sourceRecordId === document.sourceRecordId);

      await client.query(
        `
          INSERT INTO memory_documents (
            source_record_id,
            source,
            context_type,
            title,
            body_text,
            tokens,
            metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        `,
        [
          rawRecordId,
          document.source,
          document.contextType,
          document.title,
          document.text,
          document.tokens,
          JSON.stringify({
            vectorDocumentId: document.id,
            extractionCounts: {
              entities: extraction?.entities.length ?? 0,
              facts: extraction?.facts.length ?? 0,
              events: extraction?.events.length ?? 0,
              relationships: extraction?.relationships.length ?? 0,
            },
            extractionTrace: extraction?.trace ?? [],
          }),
        ],
      );
    }

    for (const capability of capabilityRegistry) {
      const preferredSources = [...new Set(records.filter((record) => capability.requiredContext.includes(record.type)).map((record) => record.source))];

      await client.query(
        `
          INSERT INTO retrieval_configs (
            capability_id,
            version,
            required_context_types,
            preferred_sources,
            retrieval_workflow,
            active
          )
          VALUES ($1, 1, $2, $3, $4::jsonb, true)
        `,
        [
          capability.id,
          capability.requiredContext,
          preferredSources,
          JSON.stringify({
            mode: "configuration_driven",
            strategy: capability.retrievalStrategy,
            workflow: capability.workflow,
          }),
        ],
      );
    }

    await client.query(
      `
        INSERT INTO context_retrieval_hints (
          capability_id,
          prioritized_context_types,
          boosted_entities,
          deprioritized_context_types,
          supporting_evidence_ids,
          explanation,
          future_use,
          review_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'candidate')
      `,
      [
        "root_cause_analysis",
        ["inventory", "supplier_incident", "service_incident"],
        ["Chicago", "Breakfast", "Omega Foods"],
        ["weather"],
        ["demo-seed-evidence"],
        "The fake demo data repeatedly connects Chicago breakfast decline to inventory shortage, supplier delay, and mobile ordering degradation.",
        "Suggest prioritizing inventory, supplier incidents, and service incidents for similar breakfast sales decline questions after human review.",
      ],
    );

    await client.query(
      `
        INSERT INTO decision_patterns (
          capability_id,
          title,
          trigger_conditions,
          supporting_evidence_ids,
          recommended_reuse,
          review_status,
          write_back_target
        )
        VALUES ($1, $2, $3, $4, $5, 'candidate', 'curated_enterprise_memory')
      `,
      [
        "root_cause_analysis",
        "Breakfast decline linked to inventory, supplier, and digital service disruption",
        ["market sales decline", "breakfast daypart impacted", "inventory shortage", "supplier delay", "service incident"],
        ["demo-seed-evidence"],
        "Use as a candidate decision pattern for future breakfast performance investigations only after review.",
      ],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }

  console.log(`Seeded curated enterprise memory with ${records.length} raw records.`);
  console.log(`Created ${knowledgeBase.nodes.length} entities, ${knowledgeBase.edges.length} relationships, and ${knowledgeBase.documents.length} documents.`);
}

function sourceRecordIdFromNodeId(nodeId: string): string | null {
  const recordPrefixes = [
    "sales_kpi:",
    "inventory:",
    "supplier_incident:",
    "campaign:",
    "service_incident:",
    "meeting_note:",
    "promotion_calendar:",
    "weather:",
  ];
  const prefix = recordPrefixes.find((candidate) => nodeId.startsWith(candidate));
  return prefix ? nodeId.slice(prefix.length) : null;
}

seed().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
