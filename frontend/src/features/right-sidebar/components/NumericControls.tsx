import { numericSliderDefinitions } from "../../../domain/editor/config";
import { Section } from "../../../shared/components/Section";
import { SliderField } from "../../../shared/components/SliderField";
import { useEditorStore } from "../../../state/EditorStore";

export function NumericControls() {
  const { state, dispatch } = useEditorStore();

  return (
    <Section
      title="Numeric Controls"
      subtitle="Advanced sliders synchronized with semantic state."
    >
      <div className="field-list">
        {numericSliderDefinitions.map((slider) => (
          <SliderField
            key={slider.id}
            label={slider.label}
            value={state.numericValues[slider.id]}
            min={-100}
            max={100}
            leftHint={slider.leftHint}
            rightHint={slider.rightHint}
            onChange={(value) => dispatch({ type: "setNumericValue", id: slider.id, value })}
          />
        ))}
      </div>
    </Section>
  );
}
