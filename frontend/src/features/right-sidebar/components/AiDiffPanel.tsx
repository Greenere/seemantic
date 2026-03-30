import { Section } from "../../../shared/components/Section";
import { useEditorStore } from "../../../state/EditorStore";

export function AiDiffPanel() {
  const {
    state: { diffMetrics },
  } = useEditorStore();

  return (
    <Section
      title="AI Diff"
      subtitle="Readable interpretation of how intent maps to concrete edits."
      meta={<span className="badge">Confidence 0.87</span>}
    >
      <div className="panel-card">
        <div className="metric-list">
          {diffMetrics.map((metric) => (
            <div key={metric.id} className="metric-row">
              <span className="metric-name">{metric.label}</span>
              <div className="metric-bar">
                <div className="metric-fill" style={{ width: `${metric.value * 100}%` }} />
              </div>
              <span className="metric-value">{metric.direction}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="status-row">
        <span className="status-value">No warnings</span>
        <span className="status-copy">Dry-run mode is mocked for M0.</span>
      </div>
    </Section>
  );
}
