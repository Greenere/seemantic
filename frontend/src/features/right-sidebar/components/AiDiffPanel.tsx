import { Section } from "../../../shared/components/Section";
import { useEditorStore } from "../../../state/EditorStore";

export function AiDiffPanel() {
  const {
    state: { interpretationMetrics, lastAppliedPrompt },
  } = useEditorStore();

  return (
    <Section
      title="Mock Interpretation"
      subtitle="A stable stand-in for future prompt-to-edit feedback."
      meta={<span className="badge">Mocked</span>}
    >
      <div className="panel-card">
        <div className="metric-list">
          {interpretationMetrics.map((metric) => (
            <div key={metric.label} className="metric-row">
              <span className="metric-name">{metric.label}</span>
              <div className="metric-bar">
                <div className="metric-fill" style={{ width: `${metric.value * 100}%` }} />
              </div>
              <span className="metric-value">
                {metric.direction === "up" ? "rise" : metric.direction === "down" ? "fall" : "hold"}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="status-row">
        <span className="status-value">Last prompt applied</span>
        <span className="status-copy">{lastAppliedPrompt}</span>
      </div>
    </Section>
  );
}
