import { describe, expect, it } from "vitest";

// Replicate the isAllowedExternalUrl logic for testing
function isAllowedExternalUrl(url: string): boolean {
	if (!url || typeof url !== "string") return false;
	try {
		const parsed = new URL(url);
		return parsed.protocol === "https:" || parsed.protocol === "http:";
	} catch {
		return false;
	}
}

describe("isAllowedExternalUrl", () => {
	it("allows https URLs", () => {
		expect(isAllowedExternalUrl("https://example.com")).toBe(true);
		expect(isAllowedExternalUrl("https://example.com/path?q=1")).toBe(true);
	});

	it("allows http URLs", () => {
		expect(isAllowedExternalUrl("http://example.com")).toBe(true);
	});

	it("rejects file: URLs", () => {
		expect(isAllowedExternalUrl("file:///etc/passwd")).toBe(false);
	});

	it("rejects javascript: URLs", () => {
		expect(isAllowedExternalUrl("javascript:alert(1)")).toBe(false);
	});

	it("rejects data: URLs", () => {
		expect(isAllowedExternalUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
	});

	it("rejects blob: URLs", () => {
		expect(isAllowedExternalUrl("blob:https://example.com/uuid")).toBe(false);
	});

	it("rejects malformed URLs", () => {
		expect(isAllowedExternalUrl("not-a-url")).toBe(false);
		expect(isAllowedExternalUrl("")).toBe(false);
	});

	it("rejects null/undefined-like inputs", () => {
		expect(isAllowedExternalUrl(null as unknown as string)).toBe(false);
		expect(isAllowedExternalUrl(undefined as unknown as string)).toBe(false);
	});
});
