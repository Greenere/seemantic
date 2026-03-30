import type { EditorState } from "./types";

export const initialEditorState: EditorState = {
  currentBranchId: "branch-golden",
  prompt: "warmer shadows, keep highlights clean",
  semanticValues: {
    warmth: 72,
    drama: 58,
    mood: 63,
    time: 78,
  },
  previewLabel: "Mountain dusk session",
  previewNote: "Mock preview surface for validating layout, language, and shared state before rendering exists.",
  lastAppliedPrompt: "warmer shadows, keep highlights clean",
  branches: [
    {
      id: "branch-base",
      label: "Base",
      note: "Original import with no semantic edits applied yet.",
    },
    {
      id: "branch-golden",
      label: "Golden Hour",
      note: "Warmer atmosphere with brighter late-day color.",
    },
    {
      id: "branch-quiet",
      label: "Quiet Mood",
      note: "Lower drama and a softer evening feel.",
    },
  ],
  interpretationMetrics: [
    { label: "Warmth", value: 0.72, direction: "up" },
    { label: "Drama", value: 0.58, direction: "up" },
    { label: "Mood", value: 0.63, direction: "down" },
  ],
};
