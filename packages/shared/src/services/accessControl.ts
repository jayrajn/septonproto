import type {
  AccessControlReport,
  ContextType,
  EnterpriseSource,
  RawRecord,
  RolePolicy,
  UserContext,
  UserRole,
} from "../domain/types";

export const currentUser: UserContext = {
  id: "user-coo-001",
  name: "COO Demo User",
  role: "COO",
};

const allSources: EnterpriseSource[] = ["SAP", "BigQuery", "Salesforce", "ServiceNow", "SharePoint"];
const allContextTypes: ContextType[] = [
  "sales_kpi",
  "inventory",
  "supplier_incident",
  "campaign",
  "service_incident",
  "meeting_note",
  "promotion_calendar",
  "weather",
];

export const rolePolicies: Record<UserRole, RolePolicy> = {
  COO: {
    role: "COO",
    description: "Executive operating view across sales, supply chain, marketing, digital incidents, and governed notes.",
    allowedSources: allSources,
    allowedContextTypes: allContextTypes,
    deniedAccessTags: ["finance_restricted", "employee_detail", "pii"],
  },
  "Supply Chain Manager": {
    role: "Supply Chain Manager",
    description: "Supply chain operating view for inventory, suppliers, promotion readiness, and demand signals.",
    allowedSources: ["SAP", "BigQuery", "Salesforce", "ServiceNow"],
    allowedContextTypes: ["inventory", "supplier_incident", "promotion_calendar", "sales_kpi", "service_incident"],
    deniedAccessTags: ["finance_restricted", "employee_detail", "pii"],
  },
  "Marketing Manager": {
    role: "Marketing Manager",
    description: "Marketing operating view for campaigns, promotion calendars, notes, and sales signals.",
    allowedSources: ["BigQuery", "Salesforce", "SharePoint"],
    allowedContextTypes: ["campaign", "promotion_calendar", "meeting_note", "sales_kpi", "weather"],
    deniedAccessTags: ["finance_restricted", "employee_detail", "pii"],
  },
  "Finance Analyst": {
    role: "Finance Analyst",
    description: "Finance view for governed sales and financial performance analysis.",
    allowedSources: ["BigQuery", "SharePoint"],
    allowedContextTypes: ["sales_kpi", "meeting_note"],
    deniedAccessTags: ["employee_detail", "pii"],
  },
};

export function applyAccessControl(records: RawRecord[], user: UserContext = currentUser): AccessControlReport {
  const policy = rolePolicies[user.role];
  const allowedRecordIds: string[] = [];
  const restrictedRecords: AccessControlReport["restrictedRecords"] = [];

  for (const record of records) {
    const denialReason = getDenialReason(record, policy);
    if (denialReason) {
      restrictedRecords.push({
        id: record.id,
        title: record.title,
        source: record.source,
        type: record.type,
        reason: denialReason,
      });
    } else {
      allowedRecordIds.push(record.id);
    }
  }

  return {
    user,
    policy,
    allowedRecordIds,
    restrictedRecords,
    trace: [
      `RBAC policy applied for ${user.role}.`,
      `${allowedRecordIds.length} records allowed for retrieval.`,
      `${restrictedRecords.length} records restricted before context ranking.`,
    ],
  };
}

function getDenialReason(record: RawRecord, policy: RolePolicy): string | null {
  if (!policy.allowedSources.includes(record.source)) {
    return `${record.source} is outside the ${policy.role} source policy.`;
  }

  if (!policy.allowedContextTypes.includes(record.type)) {
    return `${record.type} is outside the ${policy.role} context policy.`;
  }

  if (record.requiredRoles && !record.requiredRoles.includes(policy.role)) {
    return `Requires one of: ${record.requiredRoles.join(", ")}.`;
  }

  const deniedTag = record.accessTags?.find((tag) => policy.deniedAccessTags.includes(tag));
  if (deniedTag) {
    return `Blocked by restricted access tag: ${deniedTag}.`;
  }

  return null;
}
