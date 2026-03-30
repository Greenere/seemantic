import { AiDiffPanel } from "./components/AiDiffPanel";
import { NumericControls } from "./components/NumericControls";
import { RegionMaskPanel } from "./components/RegionMaskPanel";

export function RightSidebar() {
  return (
    <aside className="panel sidebar-panel">
      <div className="panel-scroll">
        <AiDiffPanel />
        <NumericControls />
        <RegionMaskPanel />
      </div>
    </aside>
  );
}
