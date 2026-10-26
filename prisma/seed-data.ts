import type { PrismaClient } from "@prisma/client";

// Every identity below is fictional. SSNs use the 900-xx-xxxx area range,
// which the SSA never issues, so they cannot collide with real numbers.

export const DEMO_USERS = [
  { id: "user_alex", name: "Alex Rivera", role: "ANALYST" },
  { id: "user_jordan", name: "Jordan Lee", role: "ANALYST" },
  { id: "user_morgan", name: "Morgan Chen", role: "COMPLIANCE_LEAD" },
  { id: "user_sam", name: "Sam Patel", role: "COMPLIANCE_LEAD" },
  { id: "user_taylor", name: "Taylor Brooks", role: "ADMIN" },
] as const;

type SeedCase = {
  id: string;
  customerName: string;
  dateOfBirth: string;
  ssn: string;
  documentType: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  status: "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "ESCALATED";
  assignedReviewerId?: string;
  escalatedById?: string;
  createdDaysAgo: number;
  updatedDaysAgo: number;
};

export const DEMO_CASES: SeedCase[] = [
  { id: "KYC-1001", customerName: "Harper Quill", dateOfBirth: "1985-03-14", ssn: "900-11-1001", documentType: "PASSPORT", riskLevel: "LOW", status: "PENDING", createdDaysAgo: 1, updatedDaysAgo: 1 },
  { id: "KYC-1002", customerName: "Elias Fernwood", dateOfBirth: "1979-07-02", ssn: "900-12-1002", documentType: "DRIVERS_LICENSE", riskLevel: "MEDIUM", status: "PENDING", createdDaysAgo: 2, updatedDaysAgo: 2 },
  { id: "KYC-1003", customerName: "Nadia Brightwater", dateOfBirth: "1992-11-23", ssn: "900-13-1003", documentType: "NATIONAL_ID", riskLevel: "HIGH", status: "PENDING", createdDaysAgo: 2, updatedDaysAgo: 2 },
  { id: "KYC-1004", customerName: "Owen Thistle", dateOfBirth: "1968-01-30", ssn: "900-14-1004", documentType: "PASSPORT", riskLevel: "MEDIUM", status: "IN_REVIEW", assignedReviewerId: "user_alex", createdDaysAgo: 5, updatedDaysAgo: 3 },
  { id: "KYC-1005", customerName: "Lena Marchetti-Vale", dateOfBirth: "1995-06-18", ssn: "900-15-1005", documentType: "STATE_ID", riskLevel: "LOW", status: "IN_REVIEW", assignedReviewerId: "user_jordan", createdDaysAgo: 4, updatedDaysAgo: 2 },
  { id: "KYC-1006", customerName: "Cyrus Oakhaven", dateOfBirth: "1974-09-09", ssn: "900-16-1006", documentType: "PASSPORT", riskLevel: "HIGH", status: "IN_REVIEW", assignedReviewerId: "user_alex", createdDaysAgo: 6, updatedDaysAgo: 1 },
  { id: "KYC-1007", customerName: "Imogen Saltmarsh", dateOfBirth: "1988-12-05", ssn: "900-17-1007", documentType: "NATIONAL_ID", riskLevel: "HIGH", status: "ESCALATED", assignedReviewerId: "user_jordan", escalatedById: "user_jordan", createdDaysAgo: 9, updatedDaysAgo: 2 },
  { id: "KYC-1008", customerName: "Rafael Duskwood", dateOfBirth: "1981-04-27", ssn: "900-18-1008", documentType: "PASSPORT", riskLevel: "HIGH", status: "ESCALATED", assignedReviewerId: "user_alex", escalatedById: "user_morgan", createdDaysAgo: 10, updatedDaysAgo: 1 },
  { id: "KYC-1009", customerName: "Priya Hollowell", dateOfBirth: "1990-02-11", ssn: "900-19-1009", documentType: "DRIVERS_LICENSE", riskLevel: "LOW", status: "APPROVED", assignedReviewerId: "user_alex", createdDaysAgo: 14, updatedDaysAgo: 12 },
  { id: "KYC-1010", customerName: "Tobias Wren", dateOfBirth: "1972-08-19", ssn: "900-20-1010", documentType: "STATE_ID", riskLevel: "MEDIUM", status: "REJECTED", assignedReviewerId: "user_jordan", createdDaysAgo: 15, updatedDaysAgo: 11 },
  { id: "KYC-1011", customerName: "Greta Ironwood", dateOfBirth: "1965-10-03", ssn: "900-21-1011", documentType: "PASSPORT", riskLevel: "HIGH", status: "APPROVED", assignedReviewerId: "user_alex", escalatedById: "user_alex", createdDaysAgo: 20, updatedDaysAgo: 16 },
  { id: "KYC-1012", customerName: "Mateo Silverleaf", dateOfBirth: "1999-05-21", ssn: "900-22-1012", documentType: "DRIVERS_LICENSE", riskLevel: "LOW", status: "PENDING", createdDaysAgo: 0, updatedDaysAgo: 0 },
  { id: "KYC-1013", customerName: "Wilhelmina Crane", dateOfBirth: "1983-03-08", ssn: "900-23-1013", documentType: "NATIONAL_ID", riskLevel: "MEDIUM", status: "PENDING", createdDaysAgo: 1, updatedDaysAgo: 1 },
  { id: "KYC-1014", customerName: "Desmond Larkspur", dateOfBirth: "1977-12-29", ssn: "900-24-1014", documentType: "PASSPORT", riskLevel: "HIGH", status: "PENDING", createdDaysAgo: 3, updatedDaysAgo: 3 },
  { id: "KYC-1015", customerName: "Yara Quillon", dateOfBirth: "1993-07-15", ssn: "900-25-1015", documentType: "STATE_ID", riskLevel: "MEDIUM", status: "IN_REVIEW", assignedReviewerId: "user_jordan", createdDaysAgo: 7, updatedDaysAgo: 4 },
  { id: "KYC-1016", customerName: "Felix Ashgrove", dateOfBirth: "1986-01-12", ssn: "900-26-1016", documentType: "DRIVERS_LICENSE", riskLevel: "LOW", status: "REJECTED", assignedReviewerId: "user_alex", createdDaysAgo: 18, updatedDaysAgo: 17 },
  { id: "KYC-1017", customerName: "Ingrid Moorcroft", dateOfBirth: "1970-11-02", ssn: "900-27-1017", documentType: "PASSPORT", riskLevel: "MEDIUM", status: "ESCALATED", assignedReviewerId: "user_alex", escalatedById: "user_alex", createdDaysAgo: 8, updatedDaysAgo: 3 },
  { id: "KYC-1018", customerName: "Kofi Brambleton", dateOfBirth: "1991-09-24", ssn: "900-28-1018", documentType: "NATIONAL_ID", riskLevel: "HIGH", status: "IN_REVIEW", assignedReviewerId: "user_jordan", createdDaysAgo: 5, updatedDaysAgo: 2 },
];

const DEMO_NOTES = [
  { caseId: "KYC-1004", authorId: "user_alex", body: "Passport photo is slightly blurred; requested a rescan.", daysAgo: 3 },
  { caseId: "KYC-1006", authorId: "user_alex", body: "Address history spans three countries in two years.", daysAgo: 1 },
  { caseId: "KYC-1007", authorId: "user_jordan", body: "Name partially matches a watchlist entry. Escalating for compliance review.", daysAgo: 2 },
  { caseId: "KYC-1008", authorId: "user_morgan", body: "Source-of-funds documentation needs a second compliance opinion.", daysAgo: 1 },
];

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

/** Wipes all tables and inserts the synthetic demo dataset. */
export async function seedDatabase(prisma: PrismaClient) {
  await prisma.$transaction([
    prisma.auditEvent.deleteMany(),
    prisma.reviewNote.deleteMany(),
    prisma.kycCase.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  await prisma.user.createMany({ data: DEMO_USERS.map((u) => ({ ...u })) });

  await prisma.kycCase.createMany({
    data: DEMO_CASES.map(({ createdDaysAgo, updatedDaysAgo, ...c }) => ({
      ...c,
      createdAt: daysAgo(createdDaysAgo),
      updatedAt: daysAgo(updatedDaysAgo),
    })),
  });

  await prisma.reviewNote.createMany({
    data: DEMO_NOTES.map(({ daysAgo: d, ...n }) => ({ ...n, createdAt: daysAgo(d) })),
  });
}
