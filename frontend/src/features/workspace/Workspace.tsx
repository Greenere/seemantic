import { PromptBar } from "./components/PromptBar";
import { WorkspaceCanvas } from "./components/WorkspaceCanvas";

export function Workspace() {
  return (
    <section className="panel workspace-panel">
      <div className="canvas-stage">
        <WorkspaceCanvas />
        <PromptBar />
      </div>
    </section>
  );
}
