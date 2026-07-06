# Septon Context Prototype

A working prototype of the Septon decision intelligence flow for a COO asking why U.S. sales declined and how to prevent recurrence before an August promotion.

## What It Demonstrates

- Enterprise connector simulation for SAP, BigQuery, Salesforce, ServiceNow, and SharePoint
- Capability routing for Root Cause Analysis
- Capability-configured confidence rules
- Knowledge processing into graph nodes, graph edges, and vector-searchable documents
- Context Engine with semantic ranking, graph paths, and live data access
- Decision Engine with recommendations, guardrails, and confidence
- Decision Evidence Package
- Context Retrieval Learning and Pattern Learning outputs

## Tech Stack

- Vite
- React
- TypeScript
- lucide-react
- pnpm

The prototype currently uses local in-memory TypeScript data instead of external databases or cloud services.

## Run Locally

```bash
pnpm install
pnpm dev
```

Then open:

```text
http://127.0.0.1:5173/
```

## Build

```bash
pnpm build
```

## Main Files

- `src/ui/App.tsx` - COO-facing UI and architecture panels
- `src/data/enterpriseRecords.ts` - mock enterprise records
- `src/services/septonRuntime.ts` - end-to-end runtime orchestrator
- `src/services/capabilityRegistry.ts` - capability contracts and confidence rules
- `src/services/contextEngine.ts` - vector, graph, and live-context retrieval
- `src/services/decisionEngine.ts` - recommendation workflow
- `src/services/evidenceStore.ts` - decision evidence package creation
- `src/services/confidenceEvaluator.ts` - capability-driven confidence scoring
