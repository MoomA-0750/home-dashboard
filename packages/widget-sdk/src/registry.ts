import type { WidgetDefinition } from "./types";

/**
 * ウィジェット定義をまとめるレジストリ。
 * apps/web はビルド時にすべてのウィジェットパッケージをこのレジストリへ登録し、
 * キャンバスはこのレジストリ経由でwidgetIdからコンポーネントを解決する。
 */
export class WidgetRegistry {
  private widgets = new Map<string, WidgetDefinition<any>>();

  register<TConfig>(definition: WidgetDefinition<TConfig>): void {
    if (this.widgets.has(definition.id)) {
      throw new Error(`Widget "${definition.id}" is already registered`);
    }
    this.widgets.set(definition.id, definition);
  }

  get(id: string): WidgetDefinition<any> | undefined {
    return this.widgets.get(id);
  }

  getAll(): WidgetDefinition<any>[] {
    return Array.from(this.widgets.values());
  }
}

export const widgetRegistry = new WidgetRegistry();

/** 型推論を効かせるためのヘルパー。ウィジェットパッケージはこれで定義をexportする */
export function defineWidget<TConfig>(definition: WidgetDefinition<TConfig>): WidgetDefinition<TConfig> {
  return definition;
}
