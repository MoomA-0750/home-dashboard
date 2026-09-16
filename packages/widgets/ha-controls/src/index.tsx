import { useCallback, useState } from "react";
import { defineWidget, usePolling, type WidgetDetailProps, type WidgetProps } from "@home-dashboard/widget-sdk";

interface HaControlsConfig {
  pollIntervalMs: number;
  /** キャンバス上のコンパクト表示に出すエンティティ数の上限。残りは詳細ビューで見る */
  compactLimit: number;
}

interface HaEntity {
  entityId: string;
  domain: string;
  name: string;
  state: string;
  unit: string | null;
  deviceClass: string | null;
}

interface ControlsResponse {
  configured: boolean;
  entities: HaEntity[];
  allowUnlock: boolean;
}

async function fetchControls(apiBaseUrl: string): Promise<ControlsResponse> {
  const res = await fetch(`${apiBaseUrl}/api/homeassistant/controls`);
  if (!res.ok) throw new Error(`home assistant API error: ${res.status}`);
  return res.json();
}

async function callService(apiBaseUrl: string, entityId: string, service: string) {
  const res = await fetch(`${apiBaseUrl}/api/homeassistant/call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entityId, service }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `service call failed: ${res.status}`);
  }
}

const DOMAIN_ICON: Record<string, string> = {
  light: "💡",
  switch: "🔌",
  lock: "🔒",
  climate: "❄️",
};

function isOn(entity: HaEntity): boolean {
  return entity.state === "on" || entity.state === "unlocked" || entity.state === "heat" || entity.state === "cool";
}

/** そのエンティティを押したときに呼ぶサービス名を決める。押せない場合はnull */
function serviceForToggle(entity: HaEntity, allowUnlock: boolean): string | null {
  switch (entity.domain) {
    case "light":
    case "switch":
      return "toggle";
    case "climate":
      return entity.state === "off" ? "turn_on" : "turn_off";
    case "lock":
      // 解錠はサーバー側で既定拒否。無効時はボタン自体を押せなくしておく
      if (entity.state === "locked") return allowUnlock ? "unlock" : null;
      return "lock";
    default:
      return null;
  }
}

function useEntityControl(apiBaseUrl: string, pollIntervalMs: number) {
  const { data, error, loading } = usePolling(() => fetchControls(apiBaseUrl), pollIntervalMs);
  /** 楽観的更新。次のポーリングで実状態に上書きされる */
  const [pending, setPending] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);

  const toggle = useCallback(
    async (entity: HaEntity, allowUnlock: boolean) => {
      const service = serviceForToggle(entity, allowUnlock);
      if (!service) return;

      const optimistic =
        entity.domain === "lock"
          ? service === "lock"
            ? "locked"
            : "unlocked"
          : isOn(entity)
            ? "off"
            : "on";
      setPending((p) => ({ ...p, [entity.entityId]: optimistic }));
      setFailure(null);
      try {
        await callService(apiBaseUrl, entity.entityId, service);
      } catch (err) {
        setPending((p) => {
          const next = { ...p };
          delete next[entity.entityId];
          return next;
        });
        setFailure(err instanceof Error ? err.message : String(err));
      }
    },
    [apiBaseUrl],
  );

  const entities = (data?.entities ?? []).map((e) =>
    pending[e.entityId] ? { ...e, state: pending[e.entityId] } : e,
  );

  return { data, entities, error, loading, toggle, failure };
}

function EntityButton({
  entity,
  allowUnlock,
  onToggle,
}: {
  entity: HaEntity;
  allowUnlock: boolean;
  onToggle: (e: HaEntity) => void;
}) {
  const service = serviceForToggle(entity, allowUnlock);
  const on = isOn(entity);

  return (
    <button
      type="button"
      className={`ha-entity ${on ? "ha-entity--on" : ""} ${service ? "" : "ha-entity--readonly"}`}
      disabled={!service}
      onClick={() => onToggle(entity)}
      title={service ? undefined : "この操作は無効化されています"}
    >
      <span className="ha-entity__icon">{DOMAIN_ICON[entity.domain] ?? "⚙️"}</span>
      <span className="ha-entity__name">{entity.name}</span>
      <span className="ha-entity__state">{entity.state}</span>
    </button>
  );
}

function HaControlsView({ ctx, config, openDetail }: WidgetProps<HaControlsConfig>) {
  const { data, entities, loading, toggle, failure } = useEntityControl(ctx.apiBaseUrl, config.pollIntervalMs);

  if (!loading && data && !data.configured) {
    return (
      <div className="widget-card ha-controls ha-controls--unconfigured">
        Home Assistant未接続
        <span className="widget-spotify__hint">サーバーの HOMEASSISTANT_URL / TOKEN を設定してください</span>
      </div>
    );
  }

  const visible = entities.slice(0, config.compactLimit);
  const hidden = entities.length - visible.length;

  return (
    <div className="widget-card ha-controls">
      {loading && !data && <span className="widget-weather__status">読み込み中…</span>}
      {failure && <span className="ha-controls__error">{failure}</span>}
      <div className="ha-controls__grid">
        {visible.map((e) => (
          <EntityButton
            key={e.entityId}
            entity={e}
            allowUnlock={data?.allowUnlock ?? false}
            onToggle={(entity) => toggle(entity, data?.allowUnlock ?? false)}
          />
        ))}
      </div>
      {hidden > 0 && (
        <button type="button" className="ha-controls__more" onClick={openDetail}>
          ほか{hidden}件
        </button>
      )}
    </div>
  );
}

function HaControlsDetail({ ctx, config }: WidgetDetailProps<HaControlsConfig>) {
  const { data, entities, toggle, failure } = useEntityControl(ctx.apiBaseUrl, config.pollIntervalMs);

  return (
    <div className="widget-detail ha-controls-detail">
      <h2>家電操作</h2>
      {failure && <p className="ha-controls__error">{failure}</p>}
      {!data?.allowUnlock && entities.some((e) => e.domain === "lock") && (
        <p className="ha-controls__note">
          解錠は無効化されています（このダッシュボードはLAN上に認証なしで公開されるため）。
          有効にするにはサーバーで <code>HOMEASSISTANT_ALLOW_UNLOCK=true</code> を設定してください。
        </p>
      )}
      <div className="ha-controls__grid ha-controls__grid--detail">
        {entities.map((e) => (
          <EntityButton
            key={e.entityId}
            entity={e}
            allowUnlock={data?.allowUnlock ?? false}
            onToggle={(entity) => toggle(entity, data?.allowUnlock ?? false)}
          />
        ))}
      </div>
    </div>
  );
}

export default defineWidget<HaControlsConfig>({
  id: "ha-controls",
  name: "家電操作",
  description: "Home Assistantの照明・スイッチ・鍵・エアコンを操作します",
  defaultSize: { w: 4, h: 1 },
  minSize: { w: 2, h: 1 },
  defaultConfig: { pollIntervalMs: 10 * 1000, compactLimit: 4 },
  Component: HaControlsView,
  DetailComponent: HaControlsDetail,
});
