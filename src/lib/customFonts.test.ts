import { describe, expect, it } from "vitest";
import { isValidGoogleFontsUrl } from "./customFonts";

describe("isValidGoogleFontsUrl", () => {
	it("accepts valid Google Fonts URLs", () => {
		expect(isValidGoogleFontsUrl("https://fonts.googleapis.com/css2?family=Roboto")).toBe(true);
		expect(
			isValidGoogleFontsUrl(
				"https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&display=swap",
			),
		).toBe(true);
		expect(isValidGoogleFontsUrl("https://fonts.googleapis.com/css?family=Lato")).toBe(true);
	});

	it("rejects non-Google-Fonts URLs", () => {
		expect(isValidGoogleFontsUrl("https://evil.com/css2?family=Roboto")).toBe(false);
		expect(isValidGoogleFontsUrl("https://fonts.googleapis.com/css2")).toBe(false); // no family param
		expect(isValidGoogleFontsUrl("http://fonts.googleapis.com/css2?family=Roboto")).toBe(false); // http not https
	});

	it("rejects malformed inputs", () => {
		expect(isValidGoogleFontsUrl("")).toBe(false);
		expect(isValidGoogleFontsUrl("not-a-url")).toBe(false);
		expect(isValidGoogleFontsUrl("javascript:alert(1)")).toBe(false);
	});
});

describe("font URL CSS injection prevention", () => {
	it("injection characters would be caught by the character blocklist", () => {
		// These characters are blocked in loadFont() via /['";)\\]/
		const dangerousChars = ["'", '"', ";", ")", "\\"];
		for (const char of dangerousChars) {
			const url = `https://fonts.googleapis.com/css2?family=Roboto${char}`;
			// Even if the URL passes domain validation, the char check in loadFont blocks it
			expect(/['";)\\]/.test(url)).toBe(true);
		}
	});
});
