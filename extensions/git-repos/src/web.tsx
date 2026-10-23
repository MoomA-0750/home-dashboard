import { defineWebExtension } from "@home-dashboard/widget-sdk";
import gitReposWidget from "./widget";
import "./web.css";

export default defineWebExtension({ widgets: [gitReposWidget] });
