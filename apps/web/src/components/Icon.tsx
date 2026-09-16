import type { CSSProperties } from "react";

/**
 * Fluent UI System Icons を CSS マスクとして描画する。
 * SVG の塗りではなく currentColor のマスクなので、親の color をそのまま継承できる。
 * アイコン本体は public/icons/*.svg（追加するときはそこに置いてこの一覧に足す）。
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
  drop: "drop_24_regular",
  dismiss: "dismiss_24_regular",
  add: "add_24_regular",
  edit: "edit_24_regular",
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
  unknown: "question_circle_24_regular",
} as const;

export type IconName = keyof typeof ICON_FILES;

interface IconProps {
  name: IconName;
  className?: string;
  /** 省略時は装飾扱い(aria-hidden)。アイコン自体が情報を持つ場合だけ指定する */
  label?: string;
}

export function Icon({ name, className, label }: IconProps) {
  const style = { "--fluent-icon": `url("/icons/${ICON_FILES[name]}.svg")` } as CSSProperties;
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
