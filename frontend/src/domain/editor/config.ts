import type { SemanticParamId, SliderDefinition } from "./types";

export const semanticSliderDefinitions: SliderDefinition<SemanticParamId>[] = [
  { id: "warmth", label: "Warmth", leftHint: "Cool", rightHint: "Warm" },
  { id: "drama", label: "Drama", leftHint: "Soft", rightHint: "Intense" },
  { id: "mood", label: "Mood", leftHint: "Bright", rightHint: "Moody" },
  { id: "time", label: "Time", leftHint: "Dawn", rightHint: "Dusk" },
];
