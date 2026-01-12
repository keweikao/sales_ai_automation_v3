import { createHmac, timingSafeEqual } from "node:crypto";
import { describe, expect, test } from "vitest";

describe("Slack 請求簽名驗證", () => {
	const signingSecret = "test-signing-secret";

	function verifySlackSignature(
		signature: string,
		timestamp: string,
		body: string,
		secret: string,
	): boolean {
		// 檢查時間戳是否在 5 分鐘內
		const now = Math.floor(Date.now() / 1000);
		const requestTime = Number.parseInt(timestamp, 10);
		if (Math.abs(now - requestTime) > 300) {
			return false;
		}

		// 計算簽名
		const sigBasestring = `v0:${timestamp}:${body}`;
		const mySignature = `v0=${createHmac("sha256", secret)
			.update(sigBasestring)
			.digest("hex")}`;

		// 比較簽名
		try {
			return timingSafeEqual(
				Buffer.from(signature),
				Buffer.from(mySignature),
			);
		} catch {
			return false;
		}
	}

	test("有效簽名應該驗證成功", () => {
		const timestamp = String(Math.floor(Date.now() / 1000));
		const body = JSON.stringify({ event: "test" });
		const sigBasestring = `v0:${timestamp}:${body}`;
		const signature = `v0=${createHmac("sha256", signingSecret)
			.update(sigBasestring)
			.digest("hex")}`;

		expect(
			verifySlackSignature(signature, timestamp, body, signingSecret),
		).toBe(true);
	});

	test("過期的時間戳應該驗證失敗", () => {
		const timestamp = String(Math.floor(Date.now() / 1000) - 600); // 10 分鐘前
		const body = JSON.stringify({ event: "test" });
		const sigBasestring = `v0:${timestamp}:${body}`;
		const signature = `v0=${createHmac("sha256", signingSecret)
			.update(sigBasestring)
			.digest("hex")}`;

		expect(
			verifySlackSignature(signature, timestamp, body, signingSecret),
		).toBe(false);
	});

	test("無效簽名應該驗證失敗", () => {
		const timestamp = String(Math.floor(Date.now() / 1000));
		const body = JSON.stringify({ event: "test" });
		const invalidSignature = "v0=invalid_signature_hash";

		expect(
			verifySlackSignature(invalidSignature, timestamp, body, signingSecret),
		).toBe(false);
	});

	test("錯誤的 signing secret 應該驗證失敗", () => {
		const timestamp = String(Math.floor(Date.now() / 1000));
		const body = JSON.stringify({ event: "test" });
		const sigBasestring = `v0:${timestamp}:${body}`;
		const signature = `v0=${createHmac("sha256", signingSecret)
			.update(sigBasestring)
			.digest("hex")}`;

		expect(
			verifySlackSignature(signature, timestamp, body, "wrong-secret"),
		).toBe(false);
	});
});
