import { tools } from "../../../domain/editor/config";
import { useEditorStore } from "../../../state/EditorStore";

export function ToolRail() {
  const { state, dispatch } = useEditorStore();

  return (
    <div className="canvas-tools">
      {tools.map((tool) => (
        <button
          key={tool.id}
          type="button"
          className={`tool-button ${state.selectedTool === tool.id ? "is-active" : ""}`}
          onClick={() => dispatch({ type: "setTool", id: tool.id })}
        >
          {tool.label}
        </button>
      ))}
    </div>
  );
}
