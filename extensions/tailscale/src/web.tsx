import { defineWebExtension } from "@home-dashboard/widget-sdk";
import tailscaleWidget from "./widget";

export default defineWebExtension({ widgets: [tailscaleWidget] });
