/**
 * ID Generation Utilities
 * Generates case numbers for conversations
 */

/**
 * Generate a case number for a conversation
 * Format: YYYYMM-IC{sequence}
 * Example: "202601-IC046", "202512-IC002"
 *
 * @param yearMonth - The year and month in YYYYMM format (e.g., "202601")
 * @param sequence - The sequence number within that month
 * @returns The formatted case number
 */
export function generateCaseNumber(
  yearMonth: string,
  sequence: number
): string {
  return `${yearMonth}-IC${sequence.toString().padStart(3, "0")}`;
}

/**
 * Generate a case number using the current date
 * @param sequence - The sequence number within the current month
 * @returns The formatted case number with current year-month
 */
export function generateCaseNumberFromDate(sequence: number): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const yearMonth = `${year}${month}`;
  return generateCaseNumber(yearMonth, sequence);
}

/**
 * Parse a case number to extract its components
 * @param caseNumber - The case number to parse (e.g., "202601-IC046")
 * @returns The parsed components or null if invalid
 */
export function parseCaseNumber(caseNumber: string): {
  yearMonth: string;
  sequence: number;
} | null {
  const match = caseNumber.match(/^(\d{6})-IC(\d{3})$/);
  if (!(match && match[1] && match[2])) return null;
  return {
    yearMonth: match[1],
    sequence: Number.parseInt(match[2], 10),
  };
}
