import { describe, expect, it } from "vitest";
import {
	createProjectData,
	createProjectSnapshot,
	hasProjectUnsavedChanges,
	isAllowedWallpaperValue,
	normalizeProjectEditor,
	PROJECT_VERSION,
	resolveProjectMedia,
	validateProjectData,
} from "./projectPersistence";

describe("projectPersistence media compatibility", () => {
	it("accepts legacy projects with a single videoPath", () => {
		const project = {
			version: 1,
			videoPath: "/tmp/screen.webm",
			editor: {},
		};

		expect(validateProjectData(project)).toBe(true);
		expect(resolveProjectMedia(project)).toEqual({
			screenVideoPath: "/tmp/screen.webm",
		});
	});

	it("rejects projects without valid media", () => {
		const project = {
			version: 1,
			editor: {},
		};
		expect(validateProjectData(project)).toBe(false);
		expect(resolveProjectMedia(project)).toBeNull();
	});

	it("rejects non-object candidates", () => {
		expect(validateProjectData(null)).toBe(false);
		expect(validateProjectData("string")).toBe(false);
		expect(validateProjectData(42)).toBe(false);
		expect(validateProjectData(undefined)).toBe(false);
	});

	it("rejects projects without version number", () => {
		const project = {
			videoPath: "/tmp/screen.webm",
			editor: {},
		};
		expect(validateProjectData(project)).toBe(false);
	});

	it("rejects projects without editor state", () => {
		const project = {
			version: 1,
			videoPath: "/tmp/screen.webm",
		};
		expect(validateProjectData(project)).toBe(false);
	});

	it("creates version 2 projects with explicit media", () => {
		const project = createProjectData(
			{
				screenVideoPath: "/tmp/screen.webm",
				webcamVideoPath: "/tmp/webcam.webm",
			},
			{
				wallpaper: "/wallpapers/wallpaper1.jpg",
				shadowIntensity: 0,
				showBlur: false,
				motionBlurAmount: 0,
				borderRadius: 0,
				padding: 50,
				cropRegion: { x: 0, y: 0, width: 1, height: 1 },
				zoomRegions: [],
				trimRegions: [],
				speedRegions: [],
				annotationRegions: [],
				aspectRatio: "16:9",
				webcamLayoutPreset: "picture-in-picture",
				webcamMaskShape: "circle",
				exportQuality: "good",
				exportFormat: "mp4",
				gifFrameRate: 15,
				gifLoop: true,
				gifSizePreset: "medium",
			},
		);

		expect(project.version).toBe(PROJECT_VERSION);
		expect(project.media).toEqual({
			screenVideoPath: "/tmp/screen.webm",
			webcamVideoPath: "/tmp/webcam.webm",
		});
		expect(validateProjectData(project)).toBe(true);
	});

	it("normalizes webcam mask shape values safely", () => {
		expect(normalizeProjectEditor({ webcamMaskShape: "rounded" }).webcamMaskShape).toBe("rounded");
		expect(
			normalizeProjectEditor({ webcamMaskShape: "not-a-real-shape" as never }).webcamMaskShape,
		).toBe("rectangle");
	});
});

it("creates stable snapshots for identical project state", () => {
	const media = {
		screenVideoPath: "/tmp/screen.webm",
		webcamVideoPath: "/tmp/webcam.webm",
	};
	const editor = normalizeProjectEditor({
		wallpaper: "/wallpapers/wallpaper1.jpg",
		shadowIntensity: 0,
		showBlur: false,
		motionBlurAmount: 0,
		borderRadius: 0,
		padding: 50,
		cropRegion: { x: 0, y: 0, width: 1, height: 1 },
		zoomRegions: [],
		trimRegions: [],
		speedRegions: [],
		annotationRegions: [],
		aspectRatio: "16:9",
		webcamLayoutPreset: "picture-in-picture",
		webcamMaskShape: "circle",
		exportQuality: "good",
		exportFormat: "mp4",
		gifFrameRate: 15,
		gifLoop: true,
		gifSizePreset: "medium",
	});

	expect(createProjectSnapshot(media, editor)).toBe(createProjectSnapshot(media, editor));
});

it("detects unsaved changes from differing snapshots", () => {
	expect(hasProjectUnsavedChanges(null, null)).toBe(false);
	expect(hasProjectUnsavedChanges("same", "same")).toBe(false);
	expect(hasProjectUnsavedChanges("current", "baseline")).toBe(true);
});

describe("isAllowedWallpaperValue", () => {
	it("allows known wallpaper asset paths", () => {
		expect(isAllowedWallpaperValue("/wallpapers/wallpaper1.jpg")).toBe(true);
		expect(isAllowedWallpaperValue("/wallpapers/wallpaper18.jpg")).toBe(true);
		expect(isAllowedWallpaperValue("/wallpapers/custom.png")).toBe(true);
		expect(isAllowedWallpaperValue("/wallpapers/bg.webp")).toBe(true);
	});

	it("rejects arbitrary local paths", () => {
		expect(isAllowedWallpaperValue("/etc/passwd")).toBe(false);
		expect(isAllowedWallpaperValue("/arbitrary/path")).toBe(false);
		expect(isAllowedWallpaperValue("/%2e%2e/secret")).toBe(false);
		expect(isAllowedWallpaperValue("/wallpapers/../../../etc/passwd")).toBe(false);
	});

	it("allows app-media:// URLs", () => {
		expect(isAllowedWallpaperValue("app-media:///path/to/wallpaper.jpg")).toBe(true);
	});

	it("allows data: image URIs", () => {
		expect(isAllowedWallpaperValue("data:image/png;base64,abc123")).toBe(true);
		expect(isAllowedWallpaperValue("data:image/jpeg;base64,xyz")).toBe(true);
	});

	it("rejects non-image data: URIs", () => {
		expect(isAllowedWallpaperValue("data:text/html,<script>alert(1)</script>")).toBe(false);
	});

	it("allows color hex values", () => {
		expect(isAllowedWallpaperValue("#ff0000")).toBe(true);
		expect(isAllowedWallpaperValue("#000")).toBe(true);
		expect(isAllowedWallpaperValue("#aabbccdd")).toBe(true);
	});

	it("allows gradient strings", () => {
		expect(isAllowedWallpaperValue("linear-gradient(to right, #000, #fff)")).toBe(true);
		expect(isAllowedWallpaperValue("radial-gradient(circle, #000, #fff)")).toBe(true);
	});

	it("rejects http URLs", () => {
		expect(isAllowedWallpaperValue("http://evil.com/image.jpg")).toBe(false);
		expect(isAllowedWallpaperValue("https://evil.com/track?user=123")).toBe(false);
	});

	it("rejects other dangerous schemes", () => {
		expect(isAllowedWallpaperValue("javascript:alert(1)")).toBe(false);
		expect(isAllowedWallpaperValue("file:///etc/passwd")).toBe(false);
		expect(isAllowedWallpaperValue("blob:https://example.com/uuid")).toBe(false);
	});

	it("rejects empty/invalid inputs", () => {
		expect(isAllowedWallpaperValue("")).toBe(false);
		expect(isAllowedWallpaperValue(null as unknown as string)).toBe(false);
		expect(isAllowedWallpaperValue(undefined as unknown as string)).toBe(false);
	});
});

describe("normalizeProjectEditor wallpaper sanitization", () => {
	it("strips external HTTP wallpaper URLs and uses default", () => {
		const result = normalizeProjectEditor({
			wallpaper: "https://evil.com/tracking-pixel.png",
		});
		expect(result.wallpaper).toBe("/wallpapers/wallpaper1.jpg");
	});

	it("preserves valid local wallpaper paths", () => {
		const result = normalizeProjectEditor({
			wallpaper: "/wallpapers/wallpaper5.jpg",
		});
		expect(result.wallpaper).toBe("/wallpapers/wallpaper5.jpg");
	});

	it("preserves data: URI wallpapers", () => {
		const result = normalizeProjectEditor({
			wallpaper: "data:image/png;base64,iVBOR",
		});
		expect(result.wallpaper).toBe("data:image/png;base64,iVBOR");
	});
});
