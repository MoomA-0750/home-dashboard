import type { CSSProperties } from "react";

/**
 * Fluent UI System Icons を CSS マスクとして描画する。
 * SVG の塗りではなく currentColor のマスクなので、親の color をそのまま継承できる。
 * アイコン本体は apps/web/public/icons/*.svg（追加するときはそこに置いてこの一覧に足す）。
 * 拡張機能が自分で持っているアイコンは src に URL を渡す（/api/extensions/<id>/files/... など）。
 */
const ICON_FILES = {
  home: "home_24_regular",
  play: "play_24_regular",
  pause: "pause_24_filled",
  next: "next_24_regular",
  previous: "previous_24_regular",
  shuffle: "arrow_shuffle_24_regular",
  repeat: "arrow_repeat_all_24_regular",
  lightbulb: "lightbulb_24_regular",
  toolbox: "toolbox_24_regular",
  settings: "settings_24_regular",
  image: "image_24_regular",
  mail: "mail_24_regular",
  desktop: "desktop_24_regular",
  phone: "phone_24_regular",
  drop: "drop_24_regular",
  dismiss: "dismiss_24_regular",
  add: "add_24_regular",
  warning: "warning_24_regular",
  edit: "edit_24_regular",
  mic: "mic_24_regular",
  send: "send_24_regular",
  chat: "chat_24_regular",
  "chat-multiple": "chat_multiple_24_regular",
  attach: "attach_24_regular",
  stop: "stop_24_filled",
  "arrow-sync": "arrow_sync_24_regular",
  delete: "delete_24_regular",
  history: "history_24_regular",
  compose: "compose_24_regular",
  "chevron-up": "chevron_up_24_regular",
  "chevron-down": "chevron_down_24_regular",
  "chevron-right": "chevron_right_24_regular",
  "chevron-left": "chevron_left_24_regular",
  grid: "grid_24_regular",
  person: "person_24_regular",
  "puzzle-piece": "puzzle_piece_24_regular",
  people: "people_24_regular",
  grip: "re_order_dots_vertical_24_regular",
  "lock-closed": "lock_closed_24_regular",
  "lock-open": "lock_open_24_regular",
  temperature: "temperature_24_regular",
  molecule: "molecule_24_regular",
  "music-note": "music_note_2_24_regular",
  speaker: "speaker_2_24_regular",
  lyrics: "text_quote_24_regular",
  sparkle: "sparkle_24_regular",
  power: "power_24_regular",
  plug: "plug_connected_24_regular",
  gauge: "gauge_24_regular",
  "shield-keyhole": "shield_keyhole_24_regular",
  "weather-sunny": "weather_sunny_24_regular",
  "weather-moon": "weather_moon_24_regular",
  "weather-partly-cloudy-day": "weather_partly_cloudy_day_24_regular",
  "weather-partly-cloudy-night": "weather_partly_cloudy_night_24_regular",
  "weather-cloudy": "weather_cloudy_24_regular",
  "weather-fog": "weather_fog_24_regular",
  "weather-rain": "weather_rain_24_regular",
  "weather-rain-showers-day": "weather_rain_showers_day_24_regular",
  "weather-snow": "weather_snow_24_regular",
  "weather-snowflake": "weather_snowflake_24_regular",
  "weather-thunderstorm": "weather_thunderstorm_24_regular",
  "weather-drizzle": "weather_drizzle_24_regular",
  "weather-rain-showers-night": "weather_rain_showers_night_24_regular",
  "weather-rain-snow": "weather_rain_snow_24_regular",
  "weather-snow-shower-day": "weather_snow_shower_day_24_regular",
  "weather-snow-shower-night": "weather_snow_shower_night_24_regular",
  "weather-hail-day": "weather_hail_day_24_regular",
  "weather-hail-night": "weather_hail_night_24_regular",
  calendar: "calendar_ltr_24_regular",
  inbox: "mail_inbox_24_regular",
  drafts: "drafts_24_regular",
  junk: "mail_warning_24_regular",
  reply: "arrow_reply_24_regular",
  globe: "globe_24_regular",
  checkmark: "checkmark_24_regular",
  location: "location_24_regular",
  clock: "clock_24_regular",
  wind: "weather_squalls_24_regular",
  eye: "eye_24_regular",
  sunrise: "weather_sunny_low_24_regular",
  uv: "weather_sunny_high_24_regular",
  leaf: "leaf_one_24_regular",
  "arrow-up": "arrow_up_24_regular",
  unknown: "question_circle_24_regular",
} as const;

export type IconName = keyof typeof ICON_FILES;

interface IconProps {
  name?: IconName;
  /** name の代わりに、SVG の URL を直接渡す */
  src?: string;
  className?: string;
  /** 省略時は装飾扱い(aria-hidden)。アイコン自体が情報を持つ場合だけ指定する */
  label?: string;
}

export function Icon({ name, src, className, label }: IconProps) {
  const url = src ?? `/icons/${ICON_FILES[name ?? "unknown"]}.svg`;
  const style = { "--fluent-icon": `url("${url}")` } as CSSProperties;
  return (
    <span
      className={className ? `fluent-icon ${className}` : "fluent-icon"}
      style={style}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

/** WMO weather code を Fluent のアイコンに割り当てる（夜は昼夜別のアイコンに差し替える） */
export function weatherIcon(code: number, isDay: boolean): IconName {
  const dayOrNight = (day: IconName, night: IconName) => (isDay ? day : night);
  // 快晴・晴れ（ほぼ雲がない）は太陽か月、薄曇りは雲のかかった太陽か月
  if (code === 0 || code === 1) return dayOrNight("weather-sunny", "weather-moon");
  if (code === 2) return dayOrNight("weather-partly-cloudy-day", "weather-partly-cloudy-night");
  if (code === 3) return "weather-cloudy";
  if (code === 45 || code === 48) return "weather-fog";
  if (code >= 51 && code <= 55) return "weather-drizzle";
  // 着氷性の霧雨・雨は、みぞれのアイコン
  if (code === 56 || code === 57 || code === 66 || code === 67) return "weather-rain-snow";
  if (code >= 61 && code <= 65) return "weather-rain";
  if (code >= 71 && code <= 75) return "weather-snow";
  if (code === 77) return "weather-snowflake";
  if (code >= 80 && code <= 82) return dayOrNight("weather-rain-showers-day", "weather-rain-showers-night");
  if (code === 85 || code === 86) return dayOrNight("weather-snow-shower-day", "weather-snow-shower-night");
  if (code === 95) return "weather-thunderstorm";
  if (code === 96 || code === 99) return dayOrNight("weather-hail-day", "weather-hail-night");
  return "unknown";
}

/** WMO の天気コード（open-meteo.com）の英語の名前。日本語はサーバーが返す condition をそのまま使う */
const WEATHER_CONDITIONS_EN: Record<number, string> = {
  0: "Clear",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Cloudy",
  45: "Fog",
  48: "Rime fog",
  51: "Drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  56: "Freezing drizzle",
  57: "Freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Rain showers",
  81: "Rain showers",
  82: "Heavy rain showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with hail",
};

/** 天気の名前。日本語はサーバーが返す condition（ja）をそのまま、英語は WMO の天気コードから引く */
export function weatherConditionText(code: number, ja: string, locale: "ja" | "en"): string {
  return locale === "ja" ? ja : (WEATHER_CONDITIONS_EN[code] ?? "Unknown");
}
