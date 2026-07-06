import { enterpriseRecords } from "../data/enterpriseRecords";
import type { EnterpriseSource, RawRecord } from "../domain/types";

export interface ConnectorStatus {
  source: EnterpriseSource;
  connected: boolean;
  recordCount: number;
  syncMode: "batch" | "stream" | "api";
  freshness: string;
}

export function syncEnterpriseConnectors(): { records: RawRecord[]; statuses: ConnectorStatus[] } {
  const sources: Array<{ source: EnterpriseSource; syncMode: ConnectorStatus["syncMode"]; freshness: string }> = [
    { source: "SAP", syncMode: "api", freshness: "12 minutes" },
    { source: "BigQuery", syncMode: "batch", freshness: "35 minutes" },
    { source: "Salesforce", syncMode: "api", freshness: "18 minutes" },
    { source: "ServiceNow", syncMode: "stream", freshness: "4 minutes" },
    { source: "SharePoint", syncMode: "batch", freshness: "2 hours" },
  ];

  const statuses = sources.map((item) => ({
    ...item,
    connected: true,
    recordCount: enterpriseRecords.filter((record) => record.source === item.source).length,
  }));

  return {
    records: enterpriseRecords,
    statuses,
  };
}
