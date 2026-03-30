import {
  createContext,
  type Dispatch,
  type PropsWithChildren,
  useContext,
  useMemo,
  useReducer,
} from "react";
import { initialEditorState } from "../domain/editor/mockData";
import type { EditorState, InterpretationMetric, SemanticParamId } from "../domain/editor/types";

type EditorAction =
  | { type: "setSemanticValue"; id: SemanticParamId; value: number }
  | { type: "setPrompt"; value: string }
  | { type: "selectBranch"; id: string }
  | { type: "applyPrompt" };

interface EditorStoreValue {
  state: EditorState;
  dispatch: Dispatch<EditorAction>;
}

const EditorStoreContext = createContext<EditorStoreValue | null>(null);

function getInterpretationMetrics(state: EditorState): InterpretationMetric[] {
  return [
    {
      label: "Warmth",
      value: state.semanticValues.warmth / 100,
      direction: state.semanticValues.warmth >= 50 ? "up" : "down",
    },
    {
      label: "Drama",
      value: state.semanticValues.drama / 100,
      direction: state.semanticValues.drama >= 50 ? "up" : "down",
    },
    {
      label: "Mood",
      value: state.semanticValues.mood / 100,
      direction: state.semanticValues.mood >= 50 ? "down" : "up",
    },
  ];
}

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "setSemanticValue": {
      const nextState = {
        ...state,
        semanticValues: {
          ...state.semanticValues,
          [action.id]: action.value,
        },
      };
      return {
        ...nextState,
        interpretationMetrics: getInterpretationMetrics(nextState),
      };
    }
    case "setPrompt":
      return {
        ...state,
        prompt: action.value,
      };
    case "selectBranch":
      return {
        ...state,
        currentBranchId: action.id,
      };
    case "applyPrompt":
      return {
        ...state,
        lastAppliedPrompt: state.prompt.trim() || "No prompt provided",
      };
    default:
      return state;
  }
}

export function EditorStoreProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(editorReducer, initialEditorState);
  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <EditorStoreContext.Provider value={value}>{children}</EditorStoreContext.Provider>;
}

export function useEditorStore() {
  const context = useContext(EditorStoreContext);

  if (!context) {
    throw new Error("useEditorStore must be used within an EditorStoreProvider");
  }

  return context;
}
