interface SidebarProps {
  editMode: boolean;
  onToggleEditMode: () => void;
  settingsOpen: boolean;
  onToggleSettings: () => void;
}

export function Sidebar({ editMode, onToggleEditMode, settingsOpen, onToggleSettings }: SidebarProps) {
  return (
    <nav className="sidebar">
      <span className="sidebar__icon sidebar__icon--active" title="ホーム">🏠</span>
      <button
        type="button"
        className={`sidebar__icon sidebar__button ${editMode ? "sidebar__icon--active" : ""}`}
        title="編集モード切り替え"
        onClick={onToggleEditMode}
      >
        ✎
      </button>
      <button
        type="button"
        className={`sidebar__icon sidebar__button ${settingsOpen ? "sidebar__icon--active" : ""}`}
        title="ウィジェットを追加"
        onClick={onToggleSettings}
      >
        ⚙
      </button>
    </nav>
  );
}
