import { Section } from "../../../shared/components/Section";
import { useEditorStore } from "../../../state/EditorStore";

export function StateInspector() {
  const {
    state: { semanticValues, currentBranchId, branches },
  } = useEditorStore();

  const currentBranch = branches.find((branch) => branch.id === currentBranchId);

  return (
    <Section
      title="State Inspector"
      subtitle="A compact readout of the local shared state used by the prototype."
    >
      <div className="state-list">
        <div className="state-card">
          <span className="state-card-label">Current branch</span>
          <span className="state-card-copy">{currentBranch?.label ?? "Base"}</span>
        </div>
        <div className="state-card">
          <span className="state-card-label">Warmth</span>
          <span className="state-card-copy">{semanticValues.warmth}</span>
        </div>
        <div className="state-card">
          <span className="state-card-label">Drama</span>
          <span className="state-card-copy">{semanticValues.drama}</span>
        </div>
        <div className="state-card">
          <span className="state-card-label">Mood</span>
          <span className="state-card-copy">{semanticValues.mood}</span>
        </div>
        <div className="state-card">
          <span className="state-card-label">Time</span>
          <span className="state-card-copy">{semanticValues.time}</span>
        </div>
      </div>
    </Section>
  );
}
