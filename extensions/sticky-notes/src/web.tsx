import { defineWebExtension } from "@home-dashboard/widget-sdk";
import stickyNotesWidget from "./widget";
import "./web.css";

export default defineWebExtension({ widgets: [stickyNotesWidget] });
