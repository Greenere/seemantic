import { AiDiffPanel } from "./components/AiDiffPanel";
import { StateInspector } from "./components/StateInspector";

export function RightSidebar() {
  return (
    <aside className="panel sidebar-panel">
      <div className="panel-scroll">
        <AiDiffPanel />
        <StateInspector />
      </div>
    </aside>
  );
}
