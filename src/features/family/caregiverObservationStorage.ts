export type CaregiverObservationDomain =
  | "dailyRoutine"
  | "conversation"
  | "appointments"
  | "navigation"
  | "medicationMoney"
  | "moodSocial"
  | "sleepAppetite"
  | "homeSafety";

export type CaregiverObservationResponse =
  | "aboutSame"
  | "occasionallyDifferent"
  | "oftenDifferent"
  | "notSure";

export type CaregiverObservationResponseMap = Partial<
  Record<CaregiverObservationDomain, CaregiverObservationResponse>
>;

export interface CaregiverObservationRecord {
  id: string;
  createdAt: string;
  selectedDomains: CaregiverObservationDomain[];
  domainResponses: CaregiverObservationResponseMap;
  note: string;
}

const STORAGE_KEY = "caregiverObservationRecords";

function createRecordId() {
  if ("crypto" in globalThis && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `caregiver_observation_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function isCaregiverObservationDomain(value: string): value is CaregiverObservationDomain {
  return [
    "dailyRoutine",
    "conversation",
    "appointments",
    "navigation",
    "medicationMoney",
    "moodSocial",
    "sleepAppetite",
    "homeSafety",
  ].includes(value);
}

function isCaregiverObservationResponse(value: string): value is CaregiverObservationResponse {
  return ["aboutSame", "occasionallyDifferent", "oftenDifferent", "notSure"].includes(value);
}

function sanitizeDomainResponses(value: unknown): CaregiverObservationResponseMap {
  if (!value || typeof value !== "object") {
    return {};
  }

  const responses = value as Record<string, unknown>;
  const sanitized: CaregiverObservationResponseMap = {};

  Object.entries(responses).forEach(([domain, response]) => {
    if (
      isCaregiverObservationDomain(domain) &&
      typeof response === "string" &&
      isCaregiverObservationResponse(response)
    ) {
      sanitized[domain] = response;
    }
  });

  return sanitized;
}

function deriveSelectedDomains(
  explicitDomains: CaregiverObservationDomain[],
  domainResponses: CaregiverObservationResponseMap,
): CaregiverObservationDomain[] {
  const responseDomains = Object.entries(domainResponses)
    .filter(([, response]) => response && response !== "aboutSame")
    .map(([domain]) => domain)
    .filter(isCaregiverObservationDomain);

  return Array.from(new Set([...explicitDomains, ...responseDomains]));
}

function sanitizeRecord(value: unknown): CaregiverObservationRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Partial<CaregiverObservationRecord>;
  const selectedDomains = Array.isArray(record.selectedDomains)
    ? record.selectedDomains.filter((domain): domain is CaregiverObservationDomain =>
        typeof domain === "string" && isCaregiverObservationDomain(domain),
      )
    : [];
  const domainResponses = sanitizeDomainResponses(record.domainResponses);

  return {
    id: typeof record.id === "string" ? record.id : createRecordId(),
    createdAt:
      typeof record.createdAt === "string" && !Number.isNaN(new Date(record.createdAt).getTime())
        ? record.createdAt
        : new Date().toISOString(),
    selectedDomains: deriveSelectedDomains(selectedDomains, domainResponses),
    domainResponses,
    note: typeof record.note === "string" ? record.note : "",
  };
}

export function getCaregiverObservationRecords(): CaregiverObservationRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      return [];
    }

    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(sanitizeRecord)
      .filter((record): record is CaregiverObservationRecord => record !== null);
  } catch (error) {
    console.error("Failed to parse caregiverObservationRecords", error);
    return [];
  }
}

export function saveCaregiverObservationRecord(
  record: Omit<CaregiverObservationRecord, "id" | "createdAt" | "selectedDomains"> &
    Partial<Pick<CaregiverObservationRecord, "selectedDomains">>,
): CaregiverObservationRecord {
  const records = getCaregiverObservationRecords();
  const domainResponses = sanitizeDomainResponses(record.domainResponses);
  const selectedDomains = deriveSelectedDomains(record.selectedDomains ?? [], domainResponses);
  const nextRecord: CaregiverObservationRecord = {
    id: createRecordId(),
    createdAt: new Date().toISOString(),
    selectedDomains,
    domainResponses,
    note: record.note.trim(),
  };

  const nextRecords = [nextRecord, ...records].slice(0, 20);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
  } catch (error) {
    console.error("Failed to save caregiverObservationRecords", error);
  }

  return nextRecord;
}

export function clearCaregiverObservationRecords(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear caregiverObservationRecords", error);
  }
}
