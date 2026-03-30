import { Section } from "../../../shared/components/Section";
import { useEditorStore } from "../../../state/EditorStore";

export function BranchTree() {
  const { state, dispatch } = useEditorStore();

  return (
    <Section
      title="Edit History"
      subtitle="Branch-aware navigation for non-destructive exploration."
      meta={<span className="badge">{state.branches.length} branches</span>}
    >
      <div className="branch-list">
        {state.branches.map((branch) => (
          <button
            key={branch.id}
            type="button"
            className={`branch-item ${branch.isCurrent ? "is-active" : ""}`}
            onClick={() => dispatch({ type: "selectBranch", id: branch.id })}
          >
            <div className="branch-meta">
              <span className="branch-name" style={{ paddingLeft: `${branch.depth * 12}px` }}>
                {branch.name}
              </span>
              <span className="branch-tag">{branch.isCurrent ? "current" : `depth ${branch.depth}`}</span>
            </div>
            <span className="branch-copy">{branch.description}</span>
          </button>
        ))}
      </div>
    </Section>
  );
}
