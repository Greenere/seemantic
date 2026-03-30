import { useEditorStore } from "../../../state/EditorStore";

export function WorkspaceCanvas() {
  const {
    state: { currentBranchId, branches, previewLabel, previewNote, semanticValues },
  } = useEditorStore();
  const currentBranch = branches.find((branch) => branch.id === currentBranchId);

  return (
    <div className="canvas-frame">
      <div
        className="canvas-overlay"
        style={{
          opacity: 0.5 + semanticValues.drama / 200,
        }}
      />
      <div className="canvas-caption">
        <div>
          <p className="badge">Branch · {currentBranch?.label ?? "Base"}</p>
          <h2 className="canvas-title">{previewLabel}</h2>
          <p className="canvas-copy">{previewNote}</p>
        </div>
        <div className="compare-pill">
          <span>Warmth {semanticValues.warmth}</span>
          <span className="compare-handle" />
        </div>
      </div>
    </div>
  );
}
