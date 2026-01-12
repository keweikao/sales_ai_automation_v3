import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: [
			"tests/api/**/*.test.ts",
			"tests/services/**/*.test.ts",
			"tests/slack-bot/**/*.test.ts",
		],
		exclude: ["tests/e2e/**/*"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html", "json"],
			include: [
				"packages/api/src/**/*.ts",
				"packages/services/src/**/*.ts",
				"apps/slack-bot/src/**/*.ts",
			],
			exclude: ["**/node_modules/**", "**/tests/**"],
		},
		setupFiles: ["tests/setup.ts"],
		testTimeout: 30000,
		hookTimeout: 30000,
		isolate: true,
		pool: "forks",
	},
	resolve: {
		alias: {
			"@sales_ai_automation_v3/db": path.resolve(__dirname, "packages/db/src"),
			"@sales_ai_automation_v3/auth": path.resolve(
				__dirname,
				"packages/auth/src",
			),
			"@sales_ai_automation_v3/services": path.resolve(
				__dirname,
				"packages/services/src",
			),
		},
	},
});
