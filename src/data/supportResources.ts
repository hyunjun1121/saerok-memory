// Official counseling resource catalog (SP-09). MVP safety rule: a resource is
// only shown to users when it carries a `lastVerifiedAt` date and a traceable
// `sourceUrl`. No phone numbers, addresses, or homepage URLs are hard-coded
// here until they are verified against the operating organization's latest
// official public information. This avoids stale or wrong emergency contacts.

export type SupportResourceType =
  | "dementiaSafetyCenter"
  | "publicCounseling"
  | "localClinic"
  | "welfareCenter";

export interface SupportResource {
  id: string;
  resourceType: SupportResourceType;
  name: string;
  region?: string;
  representativePhone?: string;
  homepageUrl?: string;
  lastVerifiedAt?: string; // ISO date — required before user-facing display
  sourceUrl?: string; // traceable official source
}

// Returns only resources that have been verified. Unverified entries must never
// reach a user-facing card. Intentionally empty until verification is done.
export function getVerifiedSupportResources(): SupportResource[] {
  const catalog: SupportResource[] = [
    // SP-09: Populate ONLY after verifying against an official source
    // (한국치매안심센터 통합정보시스템, https://www.nid.or.kr). Until then the
    // filter below keeps any entry off a user-facing card. Do NOT hard-code a
    // phone number or URL before verification.
    //
    // {
    //   id: "kr_national_dementia_center",
    //   resourceType: "dementiaSafetyCenter",
    //   name: "치매안심센터 (한국치매안심센터 통합정보시스템)",
    //   region: "대한민국",
    //   representativePhone: "<verified 대표 전화>",
    //   homepageUrl: "<verified 공식 홈페이지>",
    //   lastVerifiedAt: "<ISO date after manual verification>",
    //   sourceUrl: "<traceable official source URL>",
    // },
  ];

  return catalog.filter(
    (resource) => Boolean(resource.lastVerifiedAt) && Boolean(resource.sourceUrl),
  );
}
