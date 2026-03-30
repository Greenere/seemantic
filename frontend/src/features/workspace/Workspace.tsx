import { PromptBar } from "./components/PromptBar";
import { ToolRail } from "./components/ToolRail";
import { VariantStrip } from "./components/VariantStrip";
import { WorkspaceCanvas } from "./components/WorkspaceCanvas";

export function Workspace() {
  return (
    <section className="panel workspace-panel">
      <div className="canvas-layout">
        <ToolRail />
        <div className="canvas-stage">
          <WorkspaceCanvas />
          <VariantStrip />
          <PromptBar />
        </div>
      </div>
    </section>
  );
}
