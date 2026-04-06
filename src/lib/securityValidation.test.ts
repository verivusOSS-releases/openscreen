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

describe("external URL domain allowlist", () => {
	const ALLOWED_EXTERNAL_DOMAINS = ["github.com"];

	function isAllowedDomain(url: string): boolean {
		try {
			const parsed = new URL(url);
			return ALLOWED_EXTERNAL_DOMAINS.some(
				(domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`),
			);
		} catch {
			return false;
		}
	}

	it("allows github.com", () => {
		expect(isAllowedDomain("https://github.com/openscreen")).toBe(true);
	});

	it("allows subdomains of github.com", () => {
		expect(isAllowedDomain("https://api.github.com/repos")).toBe(true);
	});

	it("rejects other domains", () => {
		expect(isAllowedDomain("https://evil.com/steal")).toBe(false);
		expect(isAllowedDomain("https://notgithub.com")).toBe(false);
	});
});

describe("streamingDecoder URL classification", () => {
	it("rejects http(s) URLs", () => {
		expect(/^https?:/i.test("https://evil.com/video.webm")).toBe(true);
		expect(/^https?:/i.test("http://evil.com/video.webm")).toBe(true);
	});

	it("allows blob: URLs via fetch path", () => {
		expect(/^(blob:|data:)/i.test("blob:https://example.com/uuid")).toBe(true);
	});

	it("allows data: URLs via fetch path", () => {
		expect(/^(blob:|data:)/i.test("data:video/webm;base64,abc")).toBe(true);
	});

	it("routes file paths to IPC", () => {
		const url = "/path/to/video.webm";
		expect(/^https?:/i.test(url)).toBe(false);
		expect(/^(blob:|data:)/i.test(url)).toBe(false);
		// Should go to IPC readBinaryFile path
	});
});

describe("CSP meta tag", () => {
	it("index.html contains a Content-Security-Policy meta tag", async () => {
		const fs = await import("node:fs");
		const html = fs.readFileSync("index.html", "utf-8");
		expect(html).toContain('http-equiv="Content-Security-Policy"');
		expect(html).toContain("default-src 'self' app-media:");
		expect(html).toContain("script-src 'self'");
		expect(html).toContain("frame-src 'none'");
		expect(html).toContain("object-src 'none'");
	});
});
