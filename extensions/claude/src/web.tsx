import { defineWebExtension } from "@home-dashboard/widget-sdk";
import usageWidget from "./usage-widget";
import limitsWidget from "./limits-widget";

export default defineWebExtension({ widgets: [usageWidget, limitsWidget] });
