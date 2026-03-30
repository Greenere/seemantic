export type SemanticParamId = "warmth" | "drama" | "mood" | "time";

export interface Branch {
  id: string;
  label: string;
  note: string;
}

export interface InterpretationMetric {
  label: string;
  value: number;
  direction: "up" | "down" | "neutral";
}

export interface SliderDefinition<TId extends string> {
  id: TId;
  label: string;
  leftHint: string;
  rightHint: string;
}

export interface EditorState {
  currentBranchId: string;
  prompt: string;
  semanticValues: Record<SemanticParamId, number>;
  branches: Branch[];
  previewLabel: string;
  previewNote: string;
  lastAppliedPrompt: string;
  interpretationMetrics: InterpretationMetric[];
}
