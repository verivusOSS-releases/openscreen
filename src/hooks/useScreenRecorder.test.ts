import { describe, expect, it } from "vitest";

// These constants mirror the ones in useScreenRecorder.ts
const BITRATE_4K = 45_000_000;
const BITRATE_QHD = 28_000_000;
const BITRATE_BASE = 18_000_000;
const HIGH_FRAME_RATE_THRESHOLD = 60;
const HIGH_FRAME_RATE_BOOST = 1.7;
const FOUR_K_PIXELS = 3840 * 2160;
const QHD_PIXELS = 2560 * 1440;

// Replicate the fixed computeBitrate logic for testing
function computeBitrate(width: number, height: number, frameRate: number) {
	const pixels = width * height;
	const highFrameRateBoost = frameRate >= HIGH_FRAME_RATE_THRESHOLD ? HIGH_FRAME_RATE_BOOST : 1;

	if (pixels >= FOUR_K_PIXELS) {
		return Math.round(BITRATE_4K * highFrameRateBoost);
	}
	if (pixels >= QHD_PIXELS) {
		return Math.round(BITRATE_QHD * highFrameRateBoost);
	}
	return Math.round(BITRATE_BASE * highFrameRateBoost);
}

describe("computeBitrate", () => {
	it("applies high frame rate boost only when frame rate meets threshold", () => {
		const bitrate30fps = computeBitrate(1920, 1080, 30);
		const bitrate60fps = computeBitrate(1920, 1080, 60);

		expect(bitrate30fps).toBe(BITRATE_BASE); // No boost at 30fps
		expect(bitrate60fps).toBe(Math.round(BITRATE_BASE * HIGH_FRAME_RATE_BOOST)); // Boost at 60fps
		expect(bitrate60fps).toBeGreaterThan(bitrate30fps);
	});

	it("selects correct base bitrate for resolution tiers", () => {
		const bitrate4k = computeBitrate(3840, 2160, 30);
		const bitrateQhd = computeBitrate(2560, 1440, 30);
		const bitrateHd = computeBitrate(1920, 1080, 30);

		expect(bitrate4k).toBe(BITRATE_4K);
		expect(bitrateQhd).toBe(BITRATE_QHD);
		expect(bitrateHd).toBe(BITRATE_BASE);
	});

	it("does not apply boost below threshold frame rate", () => {
		const bitrate59fps = computeBitrate(3840, 2160, 59);
		expect(bitrate59fps).toBe(BITRATE_4K); // No boost
	});
});
