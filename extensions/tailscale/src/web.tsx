import { defineWebExtension } from "@home-dashboard/widget-sdk";
import tailscaleWidget from "./widget";
import "./web.css";

export default defineWebExtension({ widgets: [tailscaleWidget] });
