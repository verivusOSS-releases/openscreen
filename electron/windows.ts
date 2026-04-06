import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { app, BrowserWindow, ipcMain, net, protocol, screen } from "electron";
import { RECORDINGS_DIR } from "./main";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const APP_ROOT = path.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const RENDERER_DIST = path.join(APP_ROOT, "dist");
const HEADLESS = process.env["HEADLESS"] === "true";

function isAllowedNavigation(url: string): boolean {
	try {
		const parsed = new URL(url);
		// Allow app-media:// custom protocol
		if (parsed.protocol === "app-media:") return true;
		// Allow file:// only for local paths (not UNC/network)
		if (parsed.protocol === "file:" && !parsed.hostname) return true;
		// In dev mode, allow exact Vite dev server origin
		if (VITE_DEV_SERVER_URL) {
			const devOrigin = new URL(VITE_DEV_SERVER_URL).origin;
			if (parsed.origin === devOrigin) return true;
		}
		return false;
	} catch {
		return false;
	}
}

export function registerMediaProtocol() {
	protocol.handle("app-media", async (request) => {
		const url = new URL(request.url);
		let filePath: string;
		try {
			filePath = decodeURIComponent(url.pathname);
		} catch {
			return new Response("Invalid path", { status: 400 });
		}

		// On Windows, pathname starts with / before drive letter: /C:/...
		if (process.platform === "win32" && filePath.startsWith("/")) {
			filePath = filePath.slice(1);
		}

		const resolved = path.resolve(filePath);
		const recordingsRoot = path.resolve(RECORDINGS_DIR);
		const assetsRoot = path.resolve(
			app.isPackaged
				? path.join(process.resourcesPath, "assets")
				: path.join(APP_ROOT, "public", "assets"),
		);

		function isUnderTrustedRoot(candidate: string): boolean {
			return (
				candidate === recordingsRoot ||
				candidate.startsWith(recordingsRoot + path.sep) ||
				candidate === assetsRoot ||
				candidate.startsWith(assetsRoot + path.sep)
			);
		}

		// Check logical path first
		if (!isUnderTrustedRoot(resolved)) {
			return new Response("Forbidden", { status: 403 });
		}

		// Resolve symlinks to prevent escaping trusted roots via symlink
		let realResolved: string;
		try {
			realResolved = await fs.realpath(resolved);
		} catch {
			return new Response("Not Found", { status: 404 });
		}

		if (!isUnderTrustedRoot(realResolved)) {
			return new Response("Forbidden", { status: 403 });
		}

		return net.fetch(pathToFileURL(realResolved).toString());
	});
}

let hudOverlayWindow: BrowserWindow | null = null;

ipcMain.on("hud-overlay-hide", () => {
	if (hudOverlayWindow && !hudOverlayWindow.isDestroyed()) {
		hudOverlayWindow.minimize();
	}
});

export function createHudOverlayWindow(): BrowserWindow {
	const primaryDisplay = screen.getPrimaryDisplay();
	const { workArea } = primaryDisplay;

	const windowWidth = 600;
	const windowHeight = 160;

	const x = Math.floor(workArea.x + (workArea.width - windowWidth) / 2);
	const y = Math.floor(workArea.y + workArea.height - windowHeight - 5);

	const win = new BrowserWindow({
		width: windowWidth,
		height: windowHeight,
		minWidth: 600,
		maxWidth: 600,
		minHeight: 160,
		maxHeight: 160,
		x: x,
		y: y,
		frame: false,
		transparent: true,
		resizable: false,
		alwaysOnTop: true,
		skipTaskbar: true,
		hasShadow: false,
		show: !HEADLESS,
		webPreferences: {
			preload: path.join(__dirname, "preload.mjs"),
			nodeIntegration: false,
			contextIsolation: true,
			backgroundThrottling: false,
		},
	});

	// Block renderer-initiated popups
	win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

	// Block renderer-initiated navigation to external URLs
	win.webContents.on("will-navigate", (event, url) => {
		if (!isAllowedNavigation(url)) {
			event.preventDefault();
		}
	});

	win.webContents.on("did-finish-load", () => {
		win?.webContents.send("main-process-message", new Date().toLocaleString());
	});

	hudOverlayWindow = win;

	win.on("closed", () => {
		if (hudOverlayWindow === win) {
			hudOverlayWindow = null;
		}
	});

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(VITE_DEV_SERVER_URL + "?windowType=hud-overlay");
	} else {
		win.loadFile(path.join(RENDERER_DIST, "index.html"), {
			query: { windowType: "hud-overlay" },
		});
	}

	return win;
}

export function createEditorWindow(): BrowserWindow {
	const isMac = process.platform === "darwin";

	const win = new BrowserWindow({
		width: 1200,
		height: 800,
		minWidth: 800,
		minHeight: 600,
		...(isMac && {
			titleBarStyle: "hiddenInset",
			trafficLightPosition: { x: 12, y: 12 },
		}),
		transparent: false,
		resizable: true,
		alwaysOnTop: false,
		skipTaskbar: false,
		title: "OpenScreen",
		backgroundColor: "#000000",
		show: !HEADLESS,
		webPreferences: {
			preload: path.join(__dirname, "preload.mjs"),
			nodeIntegration: false,
			contextIsolation: true,
			backgroundThrottling: false,
		},
	});

	// Maximize the window by default
	win.maximize();

	// Block renderer-initiated popups
	win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

	// Block renderer-initiated navigation to external URLs
	win.webContents.on("will-navigate", (event, url) => {
		if (!isAllowedNavigation(url)) {
			event.preventDefault();
		}
	});

	win.webContents.on("did-finish-load", () => {
		win?.webContents.send("main-process-message", new Date().toLocaleString());
	});

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(VITE_DEV_SERVER_URL + "?windowType=editor");
	} else {
		win.loadFile(path.join(RENDERER_DIST, "index.html"), {
			query: { windowType: "editor" },
		});
	}

	return win;
}

export function createSourceSelectorWindow(): BrowserWindow {
	const { width, height } = screen.getPrimaryDisplay().workAreaSize;

	const win = new BrowserWindow({
		width: 620,
		height: 420,
		minHeight: 350,
		maxHeight: 500,
		x: Math.round((width - 620) / 2),
		y: Math.round((height - 420) / 2),
		frame: false,
		resizable: false,
		alwaysOnTop: true,
		transparent: true,
		backgroundColor: "#00000000",
		webPreferences: {
			preload: path.join(__dirname, "preload.mjs"),
			nodeIntegration: false,
			contextIsolation: true,
		},
	});

	// Block renderer-initiated popups
	win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

	// Block renderer-initiated navigation to external URLs
	win.webContents.on("will-navigate", (event, url) => {
		if (!isAllowedNavigation(url)) {
			event.preventDefault();
		}
	});

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(VITE_DEV_SERVER_URL + "?windowType=source-selector");
	} else {
		win.loadFile(path.join(RENDERER_DIST, "index.html"), {
			query: { windowType: "source-selector" },
		});
	}

	return win;
}
