import { resolve } from "node:path";

process.env.APP_DATA_DIR ??= resolve(".data");
await import("../.next/standalone/server.js");
