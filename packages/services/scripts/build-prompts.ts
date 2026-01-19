/**
 * Build script to convert markdown prompt files into TypeScript constants
 * This allows us to bundle prompts at build time for Cloudflare Workers
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PROMPTS_DIR = join(__dirname, "../prompts/meddic");
const OUTPUT_FILE = join(__dirname, "../src/llm/prompts.generated.ts");

const prompts = [
  { name: "global-context", varName: "globalContextPrompt" },
  { name: "agent1-context", varName: "agent1ContextPrompt" },
  { name: "agent2-buyer", varName: "agent2BuyerPrompt" },
  { name: "agent3-seller", varName: "agent3SellerPrompt" },
  { name: "agent4-summary", varName: "agent4SummaryPrompt" },
  { name: "agent5-crm-extractor", varName: "agent5CrmPrompt" },
  { name: "agent6-coach", varName: "agent6CoachPrompt" },
];

// Read all prompt files
const promptContents = prompts.map(({ name, varName }) => {
  const filePath = join(PROMPTS_DIR, `${name}.md`);
  const content = readFileSync(filePath, "utf-8");
  // Escape backticks and ${} in the content
  // Use double backslashes to ensure proper escaping in template literals
  const escapedContent = content
    .replace(/\\/g, "\\\\")    // Escape backslashes first
    .replace(/`/g, "\\`")       // Escape backticks
    .replace(/\$/g, "\\$");     // Escape dollar signs
  return { varName, content: escapedContent };
});

// Generate TypeScript file
const output = `// Auto-generated file - DO NOT EDIT
// Generated from markdown files in packages/services/prompts/meddic/
// Run \`bun run build:prompts\` to regenerate

${promptContents.map(({ varName, content }) => `export const ${varName} = \`${content}\`;`).join("\n\n")}
`;

writeFileSync(OUTPUT_FILE, output, "utf-8");

console.log("✅ Prompts compiled successfully!");
console.log(`Generated: ${OUTPUT_FILE}`);
