function encodeRelativeAssetPath(relativePath: string): string {
	return relativePath
		.replace(/^\/+/, "")
		.split("/")
		.filter(Boolean)
		.map((part) => encodeURIComponent(part))
		.join("/");
}

export async function getAssetPath(relativePath: string): Promise<string> {
	const encodedRelativePath = encodeRelativeAssetPath(relativePath);

	try {
		if (typeof window !== "undefined") {
			// If running in a dev server (http/https), prefer the web-served path
			if (
				window.location &&
				window.location.protocol &&
				window.location.protocol.startsWith("http")
			) {
				return `/${encodedRelativePath}`;
			}

			if (window.electronAPI && typeof window.electronAPI.getAssetBasePath === "function") {
				const base = await window.electronAPI.getAssetBasePath();
				if (base) {
					// Convert file:// base to app-media:// for safe local loading
					const baseUrl = new URL(base);
					const mediaUrl = `app-media://${baseUrl.pathname}${encodedRelativePath}`;
					return mediaUrl;
				}
			}
		}
	} catch {
		// ignore and use fallback
	}

	// Fallback for web/dev server: public/wallpapers are served at '/wallpapers/...'
	return `/${encodedRelativePath}`;
}

export default getAssetPath;
