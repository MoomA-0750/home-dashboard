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
      className="switch-track change relative shrink-0 cursor-pointer rounded-full bg-white/18 p-0 aria-checked:bg-ok focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-soft disabled:cursor-default disabled:opacity-50"
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
    >
      <span className="switch-knob knob-shadow change absolute rounded-full bg-white" />
    </button>
  );
}
