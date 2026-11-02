import { defineWebExtension } from "@home-dashboard/widget-sdk";
import stickyNotesWidget from "./widget";

export default defineWebExtension({ widgets: [stickyNotesWidget] });
