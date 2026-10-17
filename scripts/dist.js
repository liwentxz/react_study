#!/usr/bin/env node
"use strict";

/**
 * 打包入口：先构建 Next.js 静态产物，再调用 electron-builder。
 *
 * 这里统一注入国内镜像，否则 electron / electron-builder 的二进制会从 GitHub
 * 下载，在国内网络下通常直接卡死或超时。已设置的镜像不会被覆盖。
 */

const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const NEXT_BIN = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
const BUILDER_BIN = path.join(
  ROOT,
  "node_modules",
  "electron-builder",
  "cli.js",
);

process.env.ELECTRON_MIRROR ||= "https://npmmirror.com/mirrors/electron/";
process.env.ELECTRON_BUILDER_BINARIES_MIRROR ||=
  "https://npmmirror.com/mirrors/electron-builder-binaries/";

function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const rawArgs = process.argv.slice(2);
const builderArgs = rawArgs.includes("--dir")
  ? ["--win", "--dir"]
  : ["--win", "nsis"];

console.log("[dist] next build");
run([NEXT_BIN, "build"]);

console.log(`[dist] electron-builder ${builderArgs.join(" ")}`);
run([BUILDER_BIN, ...builderArgs]);
