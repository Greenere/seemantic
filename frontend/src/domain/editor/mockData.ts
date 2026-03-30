import type { EditorState } from "./types";

export const initialEditorState: EditorState = {
  selectedTool: "compare",
  prompt: "warmer shadows, keep highlights clean",
  selectedStyleId: "golden",
  selectedVariantId: "variant-b",
  activeMaskId: "mask-subject",
  semanticValues: {
    warmth: 72,
    drama: 58,
    mood: 63,
    time: 78,
  },
  numericValues: {
    exposure: 12,
    highlights: -18,
    shadows: 24,
    whites: 8,
    blacks: -10,
    clarity: 22,
  },
  styleStrength: 68,
  branches: [
    {
      id: "branch-base",
      name: "base",
      description: "Original import with no edits applied.",
      depth: 0,
      isCurrent: false,
    },
    {
      id: "branch-a1",
      name: "edit_a1",
      description: "Golden-hour direction from semantic controls.",
      depth: 1,
      isCurrent: false,
    },
    {
      id: "branch-a2",
      name: "edit_a2",
      description: "Prompt refinement for clean highlight roll-off.",
      depth: 2,
      isCurrent: true,
    },
    {
      id: "branch-b1",
      name: "edit_b1",
      description: "Alternate branch with moodier blacks.",
      depth: 1,
      isCurrent: false,
    },
  ],
  variants: [
    { id: "variant-a", name: "Variant A", description: "Soft split tone, subtle lift." },
    { id: "variant-b", name: "Variant B", description: "Warmer shadows, protected whites." },
    { id: "variant-c", name: "Variant C", description: "Higher contrast, duskier palette." },
    { id: "variant-d", name: "Variant D", description: "Low-contrast cinematic blend." },
  ],
  masks: [
    { id: "mask-subject", name: "Subject", coverageLabel: "34% coverage" },
    { id: "mask-sky", name: "Sky Gradient", coverageLabel: "21% coverage" },
  ],
  diffMetrics: [
    { id: "metric-shadows", label: "Shadows", value: 0.82, direction: "+warm" },
    { id: "metric-highlights", label: "Highlights", value: 0.16, direction: "~0" },
    { id: "metric-contrast", label: "Contrast", value: 0.44, direction: "+mid" },
  ],
};
