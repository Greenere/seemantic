import { Section } from "../../../shared/components/Section";
import { useEditorStore } from "../../../state/EditorStore";

export function BranchTree() {
  const { state, dispatch } = useEditorStore();

  return (
    <Section
      title="Branches"
      subtitle="Minimal branch context for the current semantic direction."
      meta={<span className="badge">{state.branches.length} mocked</span>}
    >
      <div className="branch-list">
        {state.branches.map((branch) => (
          <button
            key={branch.id}
            type="button"
            className={`branch-item ${state.currentBranchId === branch.id ? "is-active" : ""}`}
            onClick={() => dispatch({ type: "selectBranch", id: branch.id })}
          >
            <div className="branch-meta">
              <span className="branch-name">{branch.label}</span>
              <span className="branch-tag">
                {state.currentBranchId === branch.id ? "current" : "available"}
              </span>
            </div>
            <span className="branch-copy">{branch.note}</span>
          </button>
        ))}
      </div>
    </Section>
  );
}
