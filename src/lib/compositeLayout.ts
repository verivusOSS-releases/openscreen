export interface RenderRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface StyledRenderRect extends RenderRect {
	borderRadius: number;
	maskShape?: import("@/components/video-editor/types").WebcamMaskShape;
}

export interface Size {
	width: number;
	height: number;
}

export type WebcamLayoutPreset = "picture-in-picture" | "vertical-stack";

export interface WebcamLayoutShadow {
	color: string;
	blur: number;
	offsetX: number;
	offsetY: number;
}

interface BorderRadiusRule {
	max: number;
	min: number;
	fraction: number;
}

interface OverlayTransform {
	type: "overlay";
	maxStageFraction: number;
	marginFraction: number;
	minMargin: number;
	minSize: number;
}

interface StackTransform {
	type: "stack";
	gap: number;
}

export interface WebcamLayoutPresetDefinition {
	label: string;
	transform: OverlayTransform | StackTransform;
	borderRadius: BorderRadiusRule;
	shadow: WebcamLayoutShadow | null;
}

export interface WebcamCompositeLayout {
	screenRect: RenderRect;
	webcamRect: StyledRenderRect | null;
	/** When true, the video should be scaled to cover screenRect (cropping overflow). */
	screenCover?: boolean;
}

const MAX_STAGE_FRACTION = 0.18;
const MARGIN_FRACTION = 0.02;
const MAX_BORDER_RADIUS = 24;
const WEBCAM_LAYOUT_PRESET_MAP: Record<WebcamLayoutPreset, WebcamLayoutPresetDefinition> = {
	"picture-in-picture": {
		label: "Picture in Picture",
		transform: {
			type: "overlay",
			maxStageFraction: MAX_STAGE_FRACTION,
			marginFraction: MARGIN_FRACTION,
			minMargin: 0,
			minSize: 0,
		},
		borderRadius: {
			max: MAX_BORDER_RADIUS,
			min: 12,
			fraction: 0.12,
		},
		shadow: {
			color: "rgba(0,0,0,0.35)",
			blur: 24,
			offsetX: 0,
			offsetY: 10,
		},
	},
	"vertical-stack": {
		label: "Vertical Stack",
		transform: {
			type: "stack",
			gap: 0,
		},
		borderRadius: {
			max: 0,
			min: 0,
			fraction: 0,
		},
		shadow: null,
	},
};

export const WEBCAM_LAYOUT_PRESETS = Object.entries(WEBCAM_LAYOUT_PRESET_MAP).map(
	([value, preset]) => ({
		value: value as WebcamLayoutPreset,
		label: preset.label,
	}),
);

export function getWebcamLayoutPresetDefinition(
	preset: WebcamLayoutPreset = "picture-in-picture",
): WebcamLayoutPresetDefinition {
	return WEBCAM_LAYOUT_PRESET_MAP[preset];
}

export function getWebcamLayoutCssBoxShadow(
	preset: WebcamLayoutPreset = "picture-in-picture",
): string {
	const shadow = getWebcamLayoutPresetDefinition(preset).shadow;
	return shadow
		? `${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px ${shadow.color}`
		: "none";
}

export function computeCompositeLayout(params: {
	canvasSize: Size;
	maxContentSize?: Size;
	screenSize: Size;
	webcamSize?: Size | null;
	layoutPreset?: WebcamLayoutPreset;
	webcamPosition?: { cx: number; cy: number } | null;
	webcamMaskShape?: import("@/components/video-editor/types").WebcamMaskShape;
}): WebcamCompositeLayout | null {
	const {
		canvasSize,
		maxContentSize = canvasSize,
		screenSize,
		webcamSize,
		layoutPreset = "picture-in-picture",
		webcamPosition,
		webcamMaskShape = "rectangle",
	} = params;
	const { width: canvasWidth, height: canvasHeight } = canvasSize;
	const { width: screenWidth, height: screenHeight } = screenSize;
	const webcamWidth = webcamSize?.width;
	const webcamHeight = webcamSize?.height;
	const preset = getWebcamLayoutPresetDefinition(layoutPreset);

	if (canvasWidth <= 0 || canvasHeight <= 0 || screenWidth <= 0 || screenHeight <= 0) {
		return null;
	}

	if (preset.transform.type === "stack") {
		if (!webcamWidth || !webcamHeight || webcamWidth <= 0 || webcamHeight <= 0) {
			// No webcam — center the screen within the bounded content area
			const screenRect = centerRect({
				canvasSize,
				size: screenSize,
				maxSize: maxContentSize,
			});
			return {
				screenRect,
				webcamRect: null,
			};
		}

		// Both screen and webcam share a common width; compute heights at that width
		const screenAspect = screenWidth / screenHeight;
		const webcamAspect = webcamWidth / webcamHeight;

		// Start with the max content width, then derive heights
		const { width: maxW, height: maxH } = maxContentSize;
		let commonWidth = Math.min(maxW, canvasWidth);
		let sHeight = commonWidth / screenAspect;
		let wHeight = commonWidth / webcamAspect;
		let totalHeight = sHeight + wHeight;

		// If combined height exceeds the max, scale everything down uniformly
		if (totalHeight > maxH) {
			const heightScale = maxH / totalHeight;
			commonWidth = commonWidth * heightScale;
			sHeight = sHeight * heightScale;
			wHeight = wHeight * heightScale;
			totalHeight = sHeight + wHeight;
		}

		// Also ensure we don't exceed canvas dimensions
		if (commonWidth > canvasWidth) {
			const scale = canvasWidth / commonWidth;
			commonWidth *= scale;
			sHeight *= scale;
			wHeight *= scale;
			totalHeight = sHeight + wHeight;
		}
		if (totalHeight > canvasHeight) {
			const scale = canvasHeight / totalHeight;
			commonWidth *= scale;
			sHeight *= scale;
			wHeight *= scale;
			totalHeight = sHeight + wHeight;
		}

		const resolvedWidth = Math.round(commonWidth);
		const resolvedScreenHeight = Math.round(sHeight);
		const resolvedWebcamHeight = Math.round(wHeight);
		const resolvedTotalHeight = resolvedScreenHeight + resolvedWebcamHeight;

		// Center the stacked pair within the canvas
		const offsetX = Math.max(0, Math.floor((canvasWidth - resolvedWidth) / 2));
		const offsetY = Math.max(0, Math.floor((canvasHeight - resolvedTotalHeight) / 2));

		return {
			screenRect: {
				x: offsetX,
				y: offsetY,
				width: resolvedWidth,
				height: resolvedScreenHeight,
			},
			webcamRect: {
				x: offsetX,
				y: offsetY + resolvedScreenHeight,
				width: resolvedWidth,
				height: resolvedWebcamHeight,
				borderRadius: 0,
			},
		};
	}

	const transform = preset.transform;
	const screenRect = centerRect({
		canvasSize,
		size: screenSize,
		maxSize: maxContentSize,
	});

	if (!webcamWidth || !webcamHeight || webcamWidth <= 0 || webcamHeight <= 0) {
		return { screenRect, webcamRect: null };
	}

	const margin = Math.max(
		transform.minMargin,
		Math.round(Math.min(canvasWidth, canvasHeight) * transform.marginFraction),
	);
	const maxWidth = Math.max(transform.minSize, canvasWidth * transform.maxStageFraction);
	const maxHeight = Math.max(transform.minSize, canvasHeight * transform.maxStageFraction);
	const scale = Math.min(maxWidth / webcamWidth, maxHeight / webcamHeight);
	let width = Math.round(webcamWidth * scale);
	let height = Math.round(webcamHeight * scale);

	// Shape-specific dimension adjustments
	if (webcamMaskShape === "circle" || webcamMaskShape === "square") {
		const side = Math.min(width, height);
		width = side;
		height = side;
	}

	let webcamX: number;
	let webcamY: number;

	if (webcamPosition) {
		// Custom position: cx/cy represent the center of the webcam as a fraction of the canvas
		webcamX = Math.round(webcamPosition.cx * canvasWidth - width / 2);
		webcamY = Math.round(webcamPosition.cy * canvasHeight - height / 2);
		// Clamp to stay within canvas bounds
		webcamX = Math.max(0, Math.min(canvasWidth - width, webcamX));
		webcamY = Math.max(0, Math.min(canvasHeight - height, webcamY));
	} else {
		// Default: bottom-right with margin
		webcamX = Math.max(0, Math.round(canvasWidth - margin - width));
		webcamY = Math.max(0, Math.round(canvasHeight - margin - height));
	}

	// Shape-specific border radius
	let borderRadius: number;
	if (webcamMaskShape === "rounded") {
		borderRadius = Math.round(Math.min(width, height) * 0.3);
	} else if (webcamMaskShape === "circle") {
		borderRadius = Math.round(Math.min(width, height) / 2);
	} else {
		borderRadius = Math.min(
			preset.borderRadius.max,
			Math.max(
				preset.borderRadius.min,
				Math.round(Math.min(width, height) * preset.borderRadius.fraction),
			),
		);
	}

	return {
		screenRect,
		webcamRect: {
			x: webcamX,
			y: webcamY,
			width,
			height,
			borderRadius,
			maskShape: webcamMaskShape,
		},
	};
}

function centerRect(params: { canvasSize: Size; size: Size; maxSize: Size }): RenderRect {
	const { canvasSize, size, maxSize } = params;
	const { width: canvasWidth, height: canvasHeight } = canvasSize;
	const { width, height } = size;
	const { width: maxWidth, height: maxHeight } = maxSize;
	const scale = Math.min(maxWidth / width, maxHeight / height, 1);
	const resolvedWidth = Math.round(width * scale);
	const resolvedHeight = Math.round(height * scale);

	return {
		x: Math.max(0, Math.floor((canvasWidth - resolvedWidth) / 2)),
		y: Math.max(0, Math.floor((canvasHeight - resolvedHeight) / 2)),
		width: resolvedWidth,
		height: resolvedHeight,
	};
}
