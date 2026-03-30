import type {
  NumericParamId,
  SemanticParamId,
  SliderDefinition,
  StylePreset,
  ToolId,
} from "./types";

export const semanticSliderDefinitions: SliderDefinition<SemanticParamId>[] = [
  { id: "warmth", label: "Warmth", leftHint: "Cool", rightHint: "Warm" },
  { id: "drama", label: "Drama", leftHint: "Soft", rightHint: "Intense" },
  { id: "mood", label: "Mood", leftHint: "Bright", rightHint: "Moody" },
  { id: "time", label: "Time", leftHint: "Dawn", rightHint: "Dusk" },
];

export const numericSliderDefinitions: SliderDefinition<NumericParamId>[] = [
  { id: "exposure", label: "Exposure", leftHint: "-100", rightHint: "+100" },
  { id: "highlights", label: "Highlights", leftHint: "-100", rightHint: "+100" },
  { id: "shadows", label: "Shadows", leftHint: "-100", rightHint: "+100" },
  { id: "whites", label: "Whites", leftHint: "-100", rightHint: "+100" },
  { id: "blacks", label: "Blacks", leftHint: "-100", rightHint: "+100" },
  { id: "clarity", label: "Clarity", leftHint: "-100", rightHint: "+100" },
];

export const tools: Array<{ id: ToolId; label: string }> = [
  { id: "select", label: "Select" },
  { id: "brush", label: "Brush" },
  { id: "gradient", label: "Gradient" },
  { id: "region", label: "Region" },
  { id: "compare", label: "Compare" },
];

export const stylePresets: StylePreset[] = [
  { id: "golden", name: "Golden", description: "Warm, luminous, late-afternoon glow." },
  { id: "coastal", name: "Coastal", description: "Clean blues with airy contrast." },
  { id: "noir", name: "Noir", description: "Low-key tone with sharp separation." },
  { id: "forest", name: "Forest", description: "Deep greens and grounded shadows." },
  { id: "film", name: "Film", description: "Soft grain, lifted blacks, gentle roll-off." },
  { id: "fade", name: "Fade", description: "Pastel lift with muted endpoints." },
  { id: "vivid", name: "Vivid", description: "Punchy color and crisp depth." },
  { id: "muted", name: "Muted", description: "Reserved palette with calm contrast." },
];
