import { stylePresets } from "../../../domain/editor/config";
import { Section } from "../../../shared/components/Section";
import { SliderField } from "../../../shared/components/SliderField";
import { useEditorStore } from "../../../state/EditorStore";

export function StylePresetGrid() {
  const { state, dispatch } = useEditorStore();

  return (
    <Section
      title="Style Tiles"
      subtitle="Preset aesthetic references blended in latent-space."
      meta={<span className="badge">Strength {state.styleStrength}%</span>}
    >
      <div className="style-grid">
        {stylePresets.map((style) => (
          <button
            key={style.id}
            type="button"
            className={`style-tile ${state.selectedStyleId === style.id ? "is-active" : ""}`}
            onClick={() => dispatch({ type: "setStyle", id: style.id })}
          >
            <span className="style-tile-name">{style.name}</span>
            <span className="style-tile-copy">{style.description}</span>
          </button>
        ))}
      </div>
      <SliderField
        label="Style Strength"
        value={state.styleStrength}
        leftHint="0%"
        rightHint="100%"
        onChange={(value) => dispatch({ type: "setStyleStrength", value })}
      />
    </Section>
  );
}
