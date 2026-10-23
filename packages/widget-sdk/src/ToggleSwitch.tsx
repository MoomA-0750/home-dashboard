/** 入／切のトグルスイッチ（iOS・macOS の設定と同じ見た目。スタイルは本体の theme.css の .toggle-switch）。押した行を開かないよう、押しは行へ伝えない */
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
      className={`toggle-switch${checked ? " toggle-switch--on" : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
    >
      <span className="toggle-switch__knob" />
    </button>
  );
}
