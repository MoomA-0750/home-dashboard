import { defineWebExtension } from "@home-dashboard/widget-sdk";
import { HostSettings } from "./HostSettings";
import homelabWidget from "./widget";

export default defineWebExtension({ widgets: [homelabWidget], SettingsPanel: HostSettings });
