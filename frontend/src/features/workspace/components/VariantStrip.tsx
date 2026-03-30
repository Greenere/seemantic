import { Section } from "../../../shared/components/Section";
import { useEditorStore } from "../../../state/EditorStore";

export function VariantStrip() {
  const { state, dispatch } = useEditorStore();

  return (
    <Section
      title="Variant Strip"
      subtitle="Mocked alternatives for comparing AI-generated branches."
      meta={<span className="badge">{state.variants.length} options</span>}
    >
      <div className="variant-grid">
        {state.variants.map((variant) => (
          <button
            key={variant.id}
            type="button"
            className={`variant-card ${state.selectedVariantId === variant.id ? "is-active" : ""}`}
            onClick={() => dispatch({ type: "setVariant", id: variant.id })}
          >
            <span className="variant-name">{variant.name}</span>
            <span className="variant-copy">{variant.description}</span>
          </button>
        ))}
      </div>
    </Section>
  );
}
