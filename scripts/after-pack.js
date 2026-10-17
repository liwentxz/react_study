"use strict";

/**
 * 用纯 JS（resedit）为 Windows 可执行文件写入图标与版本信息。
 *
 * 之所以不用 electron-builder 自带的 rcedit：它的实现会经 app-builder 下载
 * winCodeSign-2.6.0 资源包，而该包内含 macOS 符号链接，在未开启 Windows
 * 开发者模式（普通用户无 SeCreateSymbolicLinkPrivilege）的机器上解压必定失败，
 * 导致打包中断。这里改用 resedit 直接改 PE 资源，效果一致且无需额外权限。
 */

const fs = require("node:fs");
const path = require("node:path");
const { NtExecutable, NtExecutableResource, Resource, Data } = require("resedit");

function parseVersion(version) {
  const parts = String(version || "1.0.0")
    .split(/[.+-]/)
    .map((v) => parseInt(v, 10) || 0);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0, parts[3] || 0];
}

function writeVersionInfo(res, appInfo) {
  const infos = Resource.VersionInfo.fromEntries(res.entries);
  if (infos.length === 0) return false;

  const vi = infos[0];
  const languages = vi.getAllLanguagesForStringValues();
  const lang = languages[0] || { lang: 1033, codepage: 1200 };
  const [major, minor, micro, revision] = parseVersion(appInfo.version);

  vi.setStringValues(
    lang,
    {
      FileDescription: appInfo.description || appInfo.productName,
      ProductName: appInfo.productName,
      CompanyName: appInfo.companyName || appInfo.productName,
      LegalCopyright: appInfo.copyright || "",
      InternalName: appInfo.productName,
      OriginalFilename: "",
    },
    true,
  );
  vi.setFileVersion(major, minor, micro, revision, lang.lang);
  vi.setProductVersion(major, minor, micro, revision, lang.lang);
  vi.outputToResourceEntries(res.entries);
  return true;
}

function writeIcon(res, iconPath) {
  if (!fs.existsSync(iconPath)) return false;

  const iconFile = Data.IconFile.from(fs.readFileSync(iconPath));
  if (!iconFile.icons || iconFile.icons.length === 0) return false;

  const groups = Resource.IconGroupEntry.fromEntries(res.entries);
  const id = groups.length > 0 ? groups[0].id : 1;
  const lang = groups.length > 0 ? groups[0].lang : 1033;
  Resource.IconGroupEntry.replaceIconsForResource(
    res.entries,
    id,
    lang,
    iconFile.icons.map((item) => item.data),
  );
  return true;
}

module.exports = async function afterPack(context) {
  const { appOutDir, packager } = context;
  const appInfo = packager.appInfo;
  const exePath = path.join(appOutDir, `${appInfo.productName}.exe`);

  if (!fs.existsSync(exePath)) {
    console.warn(`[after-pack] 未找到可执行文件，跳过资源写入：${exePath}`);
    return;
  }

  const exe = NtExecutable.from(fs.readFileSync(exePath));
  const res = NtExecutableResource.from(exe);

  const versionDone = writeVersionInfo(res, appInfo);
  const iconDone = writeIcon(
    res,
    path.join(__dirname, "..", "build", "icon.ico"),
  );

  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));

  console.log(
    `[after-pack] 已写入${versionDone ? "版本信息" : "（无版本信息）"}${
      iconDone ? "与图标" : "（未找到 build/icon.ico）"
    }：${exePath}`,
  );
};
