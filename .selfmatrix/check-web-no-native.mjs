// SelfMatrix M4 R2 ガード: web ビルド (dist/) に native シェル専用のコードが混入していないことを
// 検証する。web ビルドは `import.meta.env.VITE_SELFMATRIX_NATIVE` フラグ配下の native コードを
// tree-shake するため、これらの識別子は 0 でなければならない (web-native-parallel.md R2)。
//
// 使い方:
//   npm run build                                   # web ビルド (VITE_SELFMATRIX_NATIVE 無し)
//   node .selfmatrix/check-web-no-native.mjs        # dist/ に native 識別子が無いこと (pass=exit 0)
//   node .selfmatrix/check-web-no-native.mjs <dir>  # 対象ディレクトリを指定
//   node .selfmatrix/check-web-no-native.mjs <dir> --expect-fail
//                                                   # 逆判定: native 識別子が「有る」ことを期待する。
//                                                   #   native ビルドに対して回し、ガード自体が生きて
//                                                   #   いる (FORBIDDEN が空にされていない) ことを CI で
//                                                   #   自己検証するための負の対照 (mutation gate)。
//
// なぜコード識別子で判定するか: `call_popout` / `call_popin` のような公開 UI 文字列 (testid) は
// web/native 共通の CallControls.tsx に由来し web バンドルにも残り得るが、これは native コードの
// 混入ではない。ここで検査するのは native モジュール/契約の実体を指す識別子 (関数名・クラス名・
// bridge プロパティ名) だけ。これらが 1 つでも残っていれば native 分岐が dead code 化されずに
// バンドルへ入った = tree-shake の回帰、というシグナルになる。

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

// --- 引数: [dir] [--expect-fail] ---
const argv = process.argv.slice(2);
const expectFail = argv.includes("--expect-fail");
const dir = argv.find((a) => !a.startsWith("--")) ?? "dist";

// native シェル専用の識別子。web バンドルに 1 つでも現れたら回帰。
const FORBIDDEN = [
  "selfmatrixNative",
  "NativeCallEmbed",
  "NativeCallControl",
  "NativeIframeShim",
  "claimWidgetTransport",
  "getOrClaimWidgetTransport",
  "popoutCallView",
  "popinCallView",
  "setCallViewBounds",
  "onCallViewPlacement",
  "onCallControlState",
  "collectNativeCallLocalStorageSnapshot",
  "getSelfmatrixNativeBridge",
  "hasSelfmatrixNativeBridge",
  "onExternalMuteToggle",
];

if (!existsSync(dir)) {
  console.error(`FAIL: ${dir}/ が見つからない。先に \`npm run build\` (web ビルド) を実行すること。`);
  process.exit(2);
}

function walk(d) {
  const out = [];
  for (const entry of readdirSync(d)) {
    const p = join(d, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(js|mjs|cjs|html|css)$/.test(entry)) out.push(p);
  }
  return out;
}

const files = walk(dir);
const hits = [];
for (const file of files) {
  const content = readFileSync(file, "utf8");
  for (const id of FORBIDDEN) {
    if (content.includes(id)) hits.push(`${file}: ${id}`);
  }
}

if (expectFail) {
  // 負の対照: native ビルドに対しては FORBIDDEN が必ず検知されるべき。
  // 1 件も見つからなければガードが壊れている (FORBIDDEN 空化 / walk 対象漏れ 等) 疑い = FAIL。
  if (hits.length === 0) {
    console.error(
      `FAIL(--expect-fail): ${dir}/ (${files.length} ファイル) に native 識別子が 1 つも無い。` +
        "\nnative ビルドに対して回したなら、このガードが機能していない (FORBIDDEN が空 / 検査対象の" +
        "拡張子が漏れている 等) 可能性がある。web ビルドに対して回したなら --expect-fail は誤用。",
    );
    process.exit(1);
  }
  const found = new Set(hits.map((h) => h.split(": ")[1]));
  console.log(
    `OK(--expect-fail): ${dir}/ (${files.length} ファイル) に native 識別子 ${found.size} 種を検知。` +
      "ガードは生きている。",
  );
  process.exit(0);
}

if (hits.length > 0) {
  console.error("FAIL: web ビルドに native シェル専用の識別子が混入している (tree-shake の回帰):");
  for (const h of hits) console.error("  " + h);
  console.error(
    "\nweb ビルドは native コードを含んではならない。native 分岐が " +
      "`import.meta.env.VITE_SELFMATRIX_NATIVE` で正しくゲートされているか確認すること " +
      "(web-native-parallel.md R2)。",
  );
  process.exit(1);
}

console.log(`OK: web ビルド (${files.length} ファイル) に native シェル専用の識別子は無し。`);
