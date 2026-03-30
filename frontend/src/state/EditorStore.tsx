import {
  createContext,
  type Dispatch,
  type PropsWithChildren,
  useContext,
  useMemo,
  useReducer,
} from "react";
import { initialEditorState } from "../domain/editor/mockData";
import type {
  NumericParamId,
  SemanticParamId,
  ToolId,
  EditorState,
} from "../domain/editor/types";

type EditorAction =
  | { type: "setSemanticValue"; id: SemanticParamId; value: number }
  | { type: "setNumericValue"; id: NumericParamId; value: number }
  | { type: "setStyle"; id: string }
  | { type: "setStyleStrength"; value: number }
  | { type: "setVariant"; id: string }
  | { type: "setTool"; id: ToolId }
  | { type: "setPrompt"; value: string }
  | { type: "selectBranch"; id: string }
  | { type: "selectMask"; id: string };

interface EditorStoreValue {
  state: EditorState;
  dispatch: Dispatch<EditorAction>;
}

const EditorStoreContext = createContext<EditorStoreValue | null>(null);

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "setSemanticValue":
      return {
        ...state,
        semanticValues: {
          ...state.semanticValues,
          [action.id]: action.value,
        },
      };
    case "setNumericValue":
      return {
        ...state,
        numericValues: {
          ...state.numericValues,
          [action.id]: action.value,
        },
      };
    case "setStyle":
      return {
        ...state,
        selectedStyleId: action.id,
      };
    case "setStyleStrength":
      return {
        ...state,
        styleStrength: action.value,
      };
    case "setVariant":
      return {
        ...state,
        selectedVariantId: action.id,
      };
    case "setTool":
      return {
        ...state,
        selectedTool: action.id,
      };
    case "setPrompt":
      return {
        ...state,
        prompt: action.value,
      };
    case "selectBranch":
      return {
        ...state,
        branches: state.branches.map((branch) => ({
          ...branch,
          isCurrent: branch.id === action.id,
        })),
      };
    case "selectMask":
      return {
        ...state,
        activeMaskId: action.id,
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
