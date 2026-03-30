interface SliderFieldProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  leftHint: string;
  rightHint: string;
  onChange: (value: number) => void;
}

export function SliderField({
  label,
  value,
  min = 0,
  max = 100,
  leftHint,
  rightHint,
  onChange,
}: SliderFieldProps) {
  return (
    <label className="slider-field">
      <div className="slider-label-row">
        <span>{label}</span>
        <span className="slider-scale">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="slider-hint">
        <span>{leftHint}</span>
        <span>{rightHint}</span>
      </div>
    </label>
  );
}
