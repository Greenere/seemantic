import { useEditorStore } from "../../../state/EditorStore";

export function WorkspaceCanvas() {
  const {
    state: { selectedStyleId, selectedTool },
  } = useEditorStore();

  return (
    <div className="canvas-frame">
      <div className="canvas-overlay" />
      <div className="canvas-caption">
        <div>
          <p className="badge">Style ref · {selectedStyleId}</p>
          <h2 className="canvas-title">Mountain dusk session</h2>
          <p className="canvas-copy">
            M0 ships a mocked preview surface so we can stabilize layout, interactions, and state
            boundaries before introducing rendering or backend APIs.
          </p>
        </div>
        <div className="compare-pill">
          <span>{selectedTool === "compare" ? "Before / After" : "Live Preview"}</span>
          <span className="compare-handle" />
        </div>
      </div>
    </div>
  );
}
