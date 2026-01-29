import { mockConversation, mockOpportunity } from "./mock-data";

const API_BASE = process.env.TEST_API_URL || "http://localhost:3001";

export async function createTestOpportunity(
  authCookie: string,
  data?: Partial<typeof mockOpportunity>
) {
  const response = await fetch(`${API_BASE}/api/opportunities.create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: authCookie,
    },
    body: JSON.stringify({
      ...mockOpportunity,
      customerNumber: `test-${Date.now()}`,
      ...data,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create opportunity: ${await response.text()}`);
  }

  return response.json();
}

export async function createTestConversation(
  authCookie: string,
  opportunityId: string,
  data?: Partial<typeof mockConversation>
) {
  const response = await fetch(`${API_BASE}/api/conversations.upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: authCookie,
    },
    body: JSON.stringify({
      opportunityId,
      audioBase64: "dGVzdA==", // placeholder
      ...mockConversation,
      ...data,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create conversation: ${await response.text()}`);
  }

  return response.json();
}

export async function deleteTestOpportunity(
  authCookie: string,
  opportunityId: string
) {
  await fetch(`${API_BASE}/api/opportunities.delete`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Cookie: authCookie,
    },
    body: JSON.stringify({ opportunityId }),
  });
}

export function generateCustomerNumber(): string {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const sequence = String(Math.floor(Math.random() * 999_999)).padStart(6, "0");
  return `${yearMonth}-${sequence}`;
}

export function generateCaseNumber(): string {
  const now = new Date();
  const yearMonth =
    `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`.slice(
      2
    );
  const sequence = String(Math.floor(Math.random() * 999)).padStart(3, "0");
  return `${yearMonth}-IC${sequence}`;
}
