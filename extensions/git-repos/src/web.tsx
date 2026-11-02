import { defineWebExtension } from "@home-dashboard/widget-sdk";
import gitReposWidget from "./widget";

export default defineWebExtension({ widgets: [gitReposWidget] });
