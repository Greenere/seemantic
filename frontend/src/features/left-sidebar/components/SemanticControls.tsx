import { semanticSliderDefinitions } from "../../../domain/editor/config";
import { Section } from "../../../shared/components/Section";
import { SliderField } from "../../../shared/components/SliderField";
import { useEditorStore } from "../../../state/EditorStore";

export function SemanticControls() {
  const { state, dispatch } = useEditorStore();

  return (
    <Section
      title="Semantic Controls"
      subtitle="The smallest control set needed to validate the editing model."
    >
      <div className="field-list">
        {semanticSliderDefinitions.map((slider) => (
          <SliderField
            key={slider.id}
            label={slider.label}
            value={state.semanticValues[slider.id]}
            leftHint={slider.leftHint}
            rightHint={slider.rightHint}
            onChange={(value) => dispatch({ type: "setSemanticValue", id: slider.id, value })}
          />
        ))}
      </div>
    </Section>
  );
}
