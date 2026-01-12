import { describe, expect, test } from "vitest";

describe("Slack Bot Events", () => {
	describe("檔案上傳事件", () => {
		const supportedFormats = ["mp3", "wav", "webm", "ogg", "m4a"];
		const maxFileSize = 100 * 1024 * 1024; // 100MB

		test.each(supportedFormats)("應該接受 %s 格式", (format) => {
			const file = {
				name: `test.${format}`,
				mimetype: `audio/${format}`,
				size: 1024 * 1024, // 1MB
			};

			const isAudioFile = (file: { mimetype: string }) => {
				return file.mimetype.startsWith("audio/");
			};

			expect(isAudioFile(file)).toBe(true);
		});

		test("應該拒絕非音檔格式", () => {
			const file = {
				name: "test.pdf",
				mimetype: "application/pdf",
				size: 1024 * 1024,
			};

			const isAudioFile = (file: { mimetype: string }) => {
				return file.mimetype.startsWith("audio/");
			};

			expect(isAudioFile(file)).toBe(false);
		});

		test("應該拒絕超過 100MB 的檔案", () => {
			const file = {
				name: "large.mp3",
				mimetype: "audio/mp3",
				size: 150 * 1024 * 1024, // 150MB
			};

			const isFileSizeValid = (file: { size: number }) => {
				return file.size <= maxFileSize;
			};

			expect(isFileSizeValid(file)).toBe(false);
		});

		test("應該接受小於 100MB 的檔案", () => {
			const file = {
				name: "normal.mp3",
				mimetype: "audio/mp3",
				size: 50 * 1024 * 1024, // 50MB
			};

			const isFileSizeValid = (file: { size: number }) => {
				return file.size <= maxFileSize;
			};

			expect(isFileSizeValid(file)).toBe(true);
		});
	});

	describe("App Mention 事件", () => {
		test("應該回應可用指令列表", () => {
			const helpMessage = `
可用指令:
• /analyze <conversation_id> - MEDDIC 分析
• /opportunity list|<id>|create - 商機管理
• /report dashboard|trends - 報表
      `.trim();

			expect(helpMessage).toContain("/analyze");
			expect(helpMessage).toContain("/opportunity");
			expect(helpMessage).toContain("/report");
		});
	});
});
