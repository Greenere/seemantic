export type SemanticParamId = "warmth" | "drama" | "mood" | "time";

export type NumericParamId =
  | "exposure"
  | "highlights"
  | "shadows"
  | "whites"
  | "blacks"
  | "clarity";

export type ToolId = "select" | "brush" | "gradient" | "region" | "compare";

export interface Branch {
  id: string;
  name: string;
  description: string;
  depth: number;
  isCurrent: boolean;
}

export interface StylePreset {
  id: string;
  name: string;
  description: string;
}

export interface Variant {
  id: string;
  name: string;
  description: string;
}

export interface Mask {
  id: string;
  name: string;
  coverageLabel: string;
}

export interface DiffMetric {
  id: string;
  label: string;
  value: number;
  direction: string;
}

export interface SliderDefinition<TId extends string> {
  id: TId;
  label: string;
  leftHint: string;
  rightHint: string;
}

export interface EditorState {
  selectedTool: ToolId;
  prompt: string;
  selectedStyleId: string;
  selectedVariantId: string;
  activeMaskId: string | null;
  semanticValues: Record<SemanticParamId, number>;
  numericValues: Record<NumericParamId, number>;
  styleStrength: number;
  branches: Branch[];
  variants: Variant[];
  masks: Mask[];
  diffMetrics: DiffMetric[];
}
