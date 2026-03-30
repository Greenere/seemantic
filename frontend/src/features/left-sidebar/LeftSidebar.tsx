import { BranchTree } from "./components/BranchTree";
import { SemanticControls } from "./components/SemanticControls";

export function LeftSidebar() {
  return (
    <aside className="panel sidebar-panel">
      <div className="panel-scroll">
        <BranchTree />
        <SemanticControls />
      </div>
    </aside>
  );
}
