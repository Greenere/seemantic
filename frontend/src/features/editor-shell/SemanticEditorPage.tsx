import { LeftSidebar } from "../left-sidebar/LeftSidebar";
import { Workspace } from "../workspace/Workspace";
import { RightSidebar } from "../right-sidebar/RightSidebar";
import { useEditorStore } from "../../state/EditorStore";

export function SemanticEditorPage() {
  const {
    state: { branches, currentBranchId },
  } = useEditorStore();

  const currentBranch = branches.find((branch) => branch.id === currentBranchId);

  return (
    <main className="page-shell">
      <div className="header-bar panel panel-card">
        <div>
          <h1 className="header-title">Semantic Editor M0</h1>
          <p className="header-copy">
            Frontend-only prototype of the shared semantic editing surface, organized around
            intent controls, a central workspace, and transparent AI inspection.
          </p>
        </div>
        <div className="header-stats">
          <span className="badge">Current Branch: {currentBranch?.label ?? "Base"}</span>
          <span className="badge">Semantic Loop Prototype</span>
          <span className="badge">Frontend Only</span>
        </div>
      </div>

      <div className="editor-shell">
        <LeftSidebar />
        <Workspace />
        <RightSidebar />
      </div>
    </main>
  );
}
