import { Section } from "../../../shared/components/Section";
import { useEditorStore } from "../../../state/EditorStore";

export function RegionMaskPanel() {
  const { state, dispatch } = useEditorStore();

  return (
    <Section
      title="Region Masks"
      subtitle="Shared mask handles ready for future human and agent workflows."
      meta={<button type="button" className="ghost-button">Add Mask</button>}
    >
      <div className="mask-grid">
        {state.masks.map((mask) => (
          <button
            key={mask.id}
            type="button"
            className={`mask-card ${state.activeMaskId === mask.id ? "is-active" : ""}`}
            onClick={() => dispatch({ type: "selectMask", id: mask.id })}
          >
            <span className="mask-name">{mask.name}</span>
            <span className="mask-copy">{mask.coverageLabel}</span>
          </button>
        ))}
      </div>
      <p className="footer-note">
        Next step: connect these handles to brush, gradient, and region-select interactions in the workspace.
      </p>
    </Section>
  );
}
