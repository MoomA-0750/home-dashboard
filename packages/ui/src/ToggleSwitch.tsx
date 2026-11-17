/** 入／切のトグルスイッチ（iOS・macOS の設定と同じ形。入は正常の印の色）。押した行を開かないよう、押しは行へ伝えない */
export function ToggleSwitch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="switch-track change relative shrink-0 cursor-pointer rounded-full bg-fg/18 p-0 aria-checked:bg-ok focus-visible:outline-(length:--focus-width) focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-default disabled:opacity-(--disabled-opacity)"
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
    >
      <span className="switch-knob knob-shadow change absolute rounded-full bg-fg" />
    </button>
  );
}
