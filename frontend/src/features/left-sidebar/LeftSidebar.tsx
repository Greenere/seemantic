import { BranchTree } from "./components/BranchTree";
import { SemanticControls } from "./components/SemanticControls";
import { StylePresetGrid } from "./components/StylePresetGrid";

export function LeftSidebar() {
  return (
    <aside className="panel sidebar-panel">
      <div className="panel-scroll">
        <BranchTree />
        <SemanticControls />
        <StylePresetGrid />
      </div>
    </aside>
  );
}
