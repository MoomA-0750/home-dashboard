import {
  Button,
  cx,
  defineMessages,
  Dialog,
  List,
  ListItem,
  textFor,
  useLocale,
  type WidgetRegistry,
} from "@home-dashboard/widget-sdk";
import { Icon } from "./Icon";

const messages = defineMessages({
  ja: {
    editWidgets: "ウィジェットの編集",
    hint: "つまみをドラッグするか、矢印で並べ替えます",
    addWidget: "ウィジェットを追加",
    done: "完了",
    placed: "配置済み",
  },
  en: {
    editWidgets: "Edit widgets",
    hint: "Drag a handle or use the arrows to reorder",
    addWidget: "Add widget",
    done: "Done",
    placed: "Added",
  },
});

interface WidgetEditBarProps {
  /** 消える動きの間 */
  closing?: boolean;
  onAdd: () => void;
  onDone: () => void;
}

/**
 * 編集モードの間、画面の下に出す操作帯。
 * 設定パネルはウィジェットの列の右側を覆ってしまうので、編集中の操作はパネルではなくここに置く。
 */
export function WidgetEditBar({ closing = false, onAdd, onDone }: WidgetEditBarProps) {
  const t = messages.useT();
  return (
    <div
      className={cx(
        "raised fixed inset-x-4 bottom-6 layer-bar mx-auto flex w-fit items-center gap-3 rounded-full py-2.5 pr-2.5 pl-6 phone:above-tabbar",
        "animate-enter closing:animate-exit closing:pointer-events-none",
        closing && "is-closing",
      )}
      role="toolbar"
      aria-label={t("editWidgets")}
    >
      <span className="text-label whitespace-nowrap text-muted phone:hidden">{t("hint")}</span>
      <Button size="lg" icon="add" onClick={onAdd}>
        {t("addWidget")}
      </Button>
      <Button size="lg" variant="primary" onClick={onDone}>
        {t("done")}
      </Button>
    </div>
  );
}

interface WidgetPickerProps {
  registry: WidgetRegistry;
  /** 画面に固定表示していてレールには追加できないウィジェット（時刻・天気） */
  hiddenWidgetIds: string[];
  /** すでにレールにあるもの（同じ種類も重ねて置けるが、置いてあることは見せる） */
  placedWidgetIds: string[];
  onAdd: (widgetId: string) => void;
  onClose: () => void;
}

/** ウィジェットを追加する小窓。押すとレールの末尾に足す */
export function WidgetPicker({ registry, hiddenWidgetIds, placedWidgetIds, onAdd, onClose }: WidgetPickerProps) {
  const locale = useLocale();
  const t = messages.useT();
  const addable = registry.getAll().filter((def) => !hiddenWidgetIds.includes(def.id));

  return (
    <Dialog title={t("addWidget")} onClose={onClose}>
      <List>
        {addable.map((def) => {
          const placed = placedWidgetIds.filter((id) => id === def.id).length;
          return (
            <ListItem
              key={def.id}
              title={textFor(def.name, locale)}
              badge={placed > 0 ? `${t("placed")}${placed > 1 ? ` ×${placed}` : ""}` : undefined}
              detail={def.description ? textFor(def.description, locale) : undefined}
              leading={<Icon name="add" />}
              chevron={false}
              onClick={() => onAdd(def.id)}
            />
          );
        })}
      </List>
    </Dialog>
  );
}
