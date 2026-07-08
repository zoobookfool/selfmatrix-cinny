/**
 * SelfMatrix M1 step 3a/3b — ネイティブシェル (selfmatrix-desktop 相当。現状は
 * selfmatrix-workspace/native-prototype) が cinny の window に公開する
 * `window.selfmatrixNative` の型定義と検出ヘルパ。
 *
 * この型は「cinny 側がシェルに要求する契約」。step 3b でシェル側 (native-prototype) が
 * この契約に合わせて改修済み (`shell-preload.cjs`/`main.cjs`):
 *   - `claimWidgetTransport()` は `{ sendToView, openCallView, closeCallView,
 *     callControlInvoke, onCallControlState }` を返す。通話 View の起動/停止は
 *     (旧 `window.selfmatrixNative.ensureCallView()`/`/widget-config.json` の静的方式ではなく)
 *     通話ごとに異なる完成 URL を渡す `openCallView(completeWidgetUrl)`/`closeCallView()` に
 *     統合されている。
 *   - `notifyWidgetHostReady` 相当のチャンネルは無い — シェル側は
 *     `new ClientWidgetApi(...)` の直後に呼び出し元 (このファイルの利用側、
 *     `NativeCallEmbed` のコンストラクタ) が `openCallView()` を呼ぶ、という
 *     呼び出し順序そのものを「'message' リスナー登録済み」の保証として扱う
 *     (design の順序不変条件、`openCallView()` の契約コメント参照)。
 *   - `onCallControlState(listener)` (step 3b 新設) で call view 側の
 *     MutationObserver 由来 state push を購読できる。
 *
 * design/native-widget-transport.md §2.1 より:
 * widget→host のメッセージは、シェル preload が ipcRenderer 経由で受け取った後
 * cinny の実 window へ `window.postMessage` で折り返す。matrix-widget-api の
 * PostmessageTransport は inboundWindow=globalThis に対する本物の 'message'
 * イベントでしか受信できないため、この折り返しさえあれば ClientWidgetApi 側の
 * 受信ロジックは無改造で成立する。そのため「widget からの受信」用のコールバック
 * (例: onWidgetFromView 相当) はこの契約に含めない — ClientWidgetApi は自身の
 * PostmessageTransport で window の 'message' イベントを直接購読するため、
 * cinny 側から明示的に配線する必要が無い。
 */

/**
 * M1 step 3b (design §3 step 3b 実装要件 4): call view 側 preload の MutationObserver
 * 由来 state push の形。契約上 main world へ渡すのは structured-clone 可能な plain object
 * のみ (nativeBridge.ts 冒頭コメント参照)。シェル側は「main は解釈しない中継役」の方針を
 * ここでも踏襲しており、この push の中身を一切解釈せずそのまま右から左へ流す。そのため
 * 実際に届く plain object にはこの型に無いフィールド (例: 3a 以前の単体実証用 action の
 * push 形状) が混ざり得る — `NativeCallControl` 側は screenshare/spotlight/emphasis/sound の
 * うち実際に値が入っているフィールドだけを状態にマージし、それ以外は無視する (duck typing)。
 *
 * G4 (受け入れレビュー修正、対称化): setSoundOn/setSoundOff は他のカテゴリ B action と異なり
 * push を伴っていなかった。call-control-preload.cjs 側で成功時に (audio 要素の実測 muted 状態
 * から導出した) `sound` を push に含めるようにしたため、ここでもフィールドとして受け付ける。
 */
export interface NativeCallControlStatePush {
  screenshare?: boolean;
  spotlight?: boolean;
  emphasis?: boolean;
  sound?: boolean;
}

/** claimWidgetTransport() が通話 1 本につき 1 回だけ払い出す送信/制御 API。 */
export interface SelfmatrixNativeWidgetTransport {
  /**
   * host (cinny の ClientWidgetApi) → view (Element Call を表示する
   * WebContentsView) 方向の素通し送信。NativeIframeShim の
   * contentWindow.postMessage から呼ばれる (design §2.1 の「素通しルータ」)。
   */
  sendToView(message: unknown): void;

  /**
   * 通話 View を widget の完成 URL (Widget#getCompleteUrl() が組み立てるものと同一)
   * でロードするようシェルへ依頼する。View がまだ存在しなければ生成し、存在すれば
   * 該当 URL で読み込み直す想定 (詳細な冪等性は step 3b でシェル側と確定する)。
   *
   * SelfMatrix M1 step 3a レビュー FIX-C (契約強化): `completeWidgetUrl` は cinny
   * レンダラ (相対的に低信頼 — 任意の room state / URL テンプレート値を組み込んで
   * 組み立てられた文字列であり、悪意あるホームサーバーやなりすましイベントの影響を
   * 受け得る) が組み立てた文字列である。**シェル (main プロセス) はこれを無検証で
   * loadURL してはならない。** シェル側は EC dist の既知 base
   * (prototype では `<origin>/ec/`) に対する assertSameOrigin / prefix 検証を
   * 必ず行うこと (step 3b の実装要件)。
   *
   * web 版との対応関係: web 版 (`CallEmbed.ts`) では同じ `getCompleteUrl()` の URL を
   * `window.location.origin` + `/public/element-call/index.html` を base にした
   * iframe.src として使っている (ブラウザの同一オリジンポリシーがそのまま検証の
   * 代わりになっている)。native ではこの base が無いため、シェル静的サーバの
   * `/ec/` へのマッピング (base 相当) をシェル側で用意し、そこへの prefix 一致を
   * 明示的に検証する必要がある見込み (step 3b)。
   *
   * SelfMatrix M1 step 3a レビュー FIX-D (順序不変条件): EC ロード開始
   * (このメソッドの実際のロード開始) 前に、host 側の `ClientWidgetApi` の
   * 'message' リスナー登録が完了している必要がある (design §1.1)。呼び出し元
   * (`NativeCallEmbed` コンストラクタ) 側で保証している前提とその根拠は
   * `NativeCallEmbed.ts` のコンストラクタ冒頭コメントを参照。
   */
  /**
   * M1 step 3c-2 (localStorage 契約の実機対応): `localStorageSnapshot` は任意。call view
   * (WebContentsView) は mainWindow (cinny) とは別の Electron session partition で動くため、
   * 同一オリジンでも localStorage は共有されない — web 版 (同一オリジンの iframe 埋め込み) で
   * 成立していた「cinny が書く `matrix-setting-*` を Element Call が読む」契約
   * (`screenShareSettings.ts`/`miniTileStripSettings.ts` と element-call の
   * `settings/settings.ts` の対応関係) が、native ではこのままでは壊れる。
   * `collectNativeCallLocalStorageSnapshot()` で集めたスナップショットをここで渡すと、シェル側
   * (`native-prototype` の `call-control-preload.cjs`) が EC のバンドルが評価されるより前に
   * call view 自身の localStorage へ書き込む。シェルはこの中身を一切解釈しない (design の
   * 「中継するだけ」方針をここでも踏襲)。
   */
  openCallView(
    completeWidgetUrl: string,
    localStorageSnapshot?: Record<string, string>
  ): Promise<void>;

  /** 通話 View を閉じる (NativeCallEmbed の dispose/hangup 時に呼ぶ)。 */
  closeCallView(): Promise<void>;

  /**
   * カテゴリ B (screenshare/spotlight/emphasis/reactions/settings など、widget
   * action が存在せず call view 内の実 DOM 操作でしか実現できない操作。design §1.5/§2.2)
   * 用の RPC。action の文字列の意味解釈は call view 側 preload (シェル側、step 3b) の
   * 責務であり、cinny 側は文字列を渡すだけで中身を解釈しない (design §2.2 の
   * 「main は解釈しない correlationId 中継役」という設計方針を host 側にも適用)。
   */
  callControlInvoke(action: string): Promise<unknown>;

  /**
   * H3 (受け入れレビュー修正、major): 「共有開始時に再同期」する live localStorage 契約。
   * web 版の実契約 (element-call の `LocalMember.ts`) は EC が **共有開始のたびに**
   * `Setting.getStoredValue()` で localStorage を再読込する。`openCallView()` の
   * `localStorageSnapshot` 引数は join 時点 (`NativeCallEmbed` コンストラクタ実行時) の
   * 1 回きりのスナップショットに過ぎず、通話中に画質/FPS 設定 (`screenShareSettings.ts`) が
   * 変更されても call view 側の localStorage には反映されないままだった。
   *
   * このメソッドは `openCallView()` の pending スナップショット経路とは完全に独立しており、
   * 呼び出した時点のスナップショットを call view の localStorage へ即座に反映する。EC は
   * 画面共有ボタンのクリック時に設定を読み直す (web 版と同じタイミング) ため、呼び出し元
   * (`NativeCallControl.toggleScreenshare()`) は `callControlInvoke()` で実際にクリックを
   * 発生させる **前** にこれを `await` し、届いていることを保証してから RPC を実行すること —
   * こうすることで web 版の「クリック時に再読込する」契約と等価になる。
   */
  updateCallLocalStorage(snapshot: Record<string, string>): Promise<void>;

  /**
   * M1 step 3b 新設 (design §3 step 3b 実装要件 4): call view 側 preload の
   * MutationObserver 由来 state push を購読する。3a の `NativeCallControl` は自分の
   * クリック成功時のみ状態更新する optimistic 実装で、実 DOM とズレても補正されなかった
   * (design の課題認識)。この購読が push を運ぶことで `NativeCallControl` が実状態に
   * 再同期できるようになる。戻り値は unsubscribe 関数 (dispose() で呼ぶこと)。
   */
  onCallControlState(listener: (state: NativeCallControlStatePush) => void): () => void;

  /**
   * M2 (Fable 全体レビュー arch-major 解消、bounds 同期): web 版では
   * `useCallEmbedPlacementSync` (hooks/useCallEmbed.ts) が CallView 内の実レイアウト座標
   * (サイドバー開閉・チャット切替・ウィンドウリサイズに追従する `ResizeObserver` 計測値) を
   * 毎フレーム計算し、`CallEmbedProvider` の `position:fixed` div (`data-call-embed-container`、
   * iframe 実体入り) へ直接スタイル適用するだけで完結する。native では実描画が別プロセスの
   * WebContentsView (シェル側の `state.callView`) にあり、DOM の外にあるため、この矩形を
   * シェルへ伝える経路そのものが無いと call view は常にシェル側の固定式配置のままになる
   * (これが本メソッド新設の動機)。
   *
   * fire-and-forget (戻り値なし)。呼び出し元 (`NativeCallEmbed.setPlacement()`) 側で
   * 失敗を検知する手段は無いが、これは意図的 — call view の配置がずれても cinny 自身の
   * 表示・機能には影響しないため、失敗時にレンダラの他の処理をブロック/エラー化する必要がない
   * (`sendToView()`/`closeCallView()` 等、既存の他の fire-and-forget 系メソッドと同じ方針)。
   *
   * **座標系**: CSS px。Electron `BrowserWindow` の content 領域 (OS ネイティブのタイトルバー等を
   * 除いた、`webContents` が実際に描画する領域) の左上を原点とする。`zoomFactor` が 1 であることが
   * 前提 — cinny は `zoomFactor` を変更する UI を持たないため通常はこの前提が成立するが、将来
   * ズーム機能が追加された場合はこの契約の再検討が必要になる (`getBoundingClientRect()` は
   * CSS px を返す一方、シェル側の `View.setBounds()` は DIP 単位で、`zoomFactor !== 1` だと
   * 両者がズレる)。`width`/`height` は非負であること。
   *
   * **送信頻度**: `useCallEmbedPlacementSync` の `ResizeObserver` 発火のたび (レイアウト変化 =
   * サイドバー開閉・チャット切替・ウィンドウリサイズ等の都度)。過剰送信の抑制 (同値スキップ +
   * `requestAnimationFrame` 1 回へのまとめ) は呼び出し元 `NativeCallEmbed.setPlacement()`
   * 側の責務 (詳細は同メソッドのコメント参照) — シェル側は「多少の頻度・わずかな適用遅延」を
   * 許容できる実装であること (厳密な毎フレーム同期までは保証しない)。
   *
   * **null**: call view を隠す/レイアウト外に置くべきことを表す (例: `CallView` コンポーネント
   * 自体がアンマウントされた、または別 room を見ていて自分の通話が背景で継続しているだけで
   * この room の CallView がその通話の表示先ではなくなった場合)。
   *
   * **detached (別窓 popout) 中**: M3 スコープの `callWindow` 再親子付け UI がまだ無いため、
   * native では popout 自体を提供していない (`useCallPopout`/`useCallPopin` の
   * `hasSelfmatrixNativeBridge()` ガード参照) — そのため cinny 側は detach 中にこのメソッドを
   * 呼ぶ状況そのものが (現状) 発生しない。シェル側 (`main.cjs`) は念のため
   * `callViewState !== "attached"` のときは受信しても適用しない防御を持つ (detached 中の
   * 別窓のレイアウトは `callWindow` 側の責務、M3 スコープ)。
   */
  setCallViewBounds(bounds: { x: number; y: number; width: number; height: number } | null): void;
}

/** `window.selfmatrixNative` の型。シェル preload が contextBridge 経由で公開する。 */
export interface SelfmatrixNativeBridge {
  /**
   * 通話 1 本につき 1 回だけ呼び出せる (claim-once)。prototype の実装は 2 回目以降の
   * 呼び出しで例外を投げる (同一オリジンの子フレームから送信 API に到達される経路を
   * 塞ぐための対策。design の「残存リスク」節参照)。NativeCallEmbed は通話ごとに
   * 新しいインスタンスを生成するたびに 1 回だけこれを呼ぶ。
   */
  claimWidgetTransport(): SelfmatrixNativeWidgetTransport;
}

declare global {
  interface Window {
    selfmatrixNative?: SelfmatrixNativeBridge;
  }
}

/** ネイティブシェル (WebContentsView ベースの通話ホスト) 内で動作しているかどうか。 */
export function hasSelfmatrixNativeBridge(): boolean {
  return typeof window !== 'undefined' && window.selfmatrixNative !== undefined;
}

/**
 * M1 step 3c-2 (localStorage 契約の実機対応): cinny 自身の localStorage から
 * `matrix-setting-` プレフィックスのキー (element-call の `Setting` クラス —
 * `element-call/src/settings/settings.ts` — が使う命名規約と完全一致。cinny 側の書き込み元は
 * `screenShareSettings.ts`/`miniTileStripSettings.ts`) だけを集めてスナップショットにする。
 * `openCallView()` の `localStorageSnapshot` 引数にそのまま渡す用途。
 *
 * プレフィックスで絞る理由: cinny 自身の設定 (テーマ選択、既読マーカー等、`matrix-setting-`
 * 以外の膨大な localStorage キー) を EC 側へ無条件に渡さないための最小化。EC が実際に読むのは
 * `Setting` クラス経由のキーだけなので、これ以外は渡しても無意味かつ情報過多になる。
 */
export function collectNativeCallLocalStorageSnapshot(): Record<string, string> {
  const snapshot: Record<string, string> = {};
  if (typeof localStorage === 'undefined') return snapshot;
  const PREFIX = 'matrix-setting-';
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PREFIX)) {
      const value = localStorage.getItem(key);
      if (value !== null) snapshot[key] = value;
    }
  }
  return snapshot;
}

/**
 * `window.selfmatrixNative` を返す。通常のブラウザ/web 版 cinny では常に undefined。
 * createCallEmbed() の native 分岐の検出に使う。
 */
export function getSelfmatrixNativeBridge(): SelfmatrixNativeBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.selfmatrixNative;
}

/**
 * G2 (受け入れレビュー修正、major): `claimWidgetTransport()` はシェル側の設計上
 * プロセス寿命 (シェル window 1 個) につき 1 回しか呼び出せない (`SelfmatrixNativeBridge.
 * claimWidgetTransport()` の JSDoc、shell-preload.cjs の claim-once ガード参照) — これは
 * 「同一オリジンの子フレーム (cinny 埋め込み) から window.parent 経由で送信 API に到達される」
 * 経路を塞ぐためのセキュリティ対策であり、この特性自体は変えてはならない (シェル側は無改造)。
 *
 * 一方 cinny 側の `NativeCallEmbed` は通話ごとに新しいインスタンスを生成し、そのコンストラクタで
 * 毎回 `bridge.claimWidgetTransport()` を呼んでいた。1 通話目は claim-once ガードを消費して
 * 成功するが、2 通話目 (hangup → 再入室等) のコンストラクタ実行時には 2 回目の呼び出しになり
 * シェル側が例外を投げる — 結果として 2 通話目の `NativeCallEmbed` 構築そのものが throw する
 * バグがあった。
 *
 * 修正はシェルの claim-once セキュリティ特性を変えずに cinny 側だけで完結させる: このモジュール
 * スコープのキャッシュ (`WeakMap<bridge, transport>`) 付きヘルパーを経由させ、初回だけ実際に
 * `claimWidgetTransport()` を呼び、以降はキャッシュ済みの transport をそのまま返す。
 * `SelfmatrixNativeWidgetTransport` (sendToView/openCallView/closeCallView/callControlInvoke/
 * onCallControlState) はいずれも通話固有の状態を保持しないステートレスな中継 API
 * (call view 自体の生成/破棄は main プロセスの `state.callView` が管理し、transport はその薄い
 * RPC 窓口に過ぎない) なので、通話をまたいで同じ transport インスタンスを再利用しても安全。
 *
 * 唯一「通話ごとに新しくする」必要があるのは `onCallControlState` の購読/購読解除であり、これは
 * transport 自体ではなく呼び出し側 (`NativeCallControl`) の責務のまま変えていない —
 * `NativeCallControl` は自分のコンストラクタで `transport.onCallControlState(...)` を呼んで
 * インスタンスごとに subscribe し、`dispose()` で自分の unsubscribe 関数を呼ぶ。transport 自体を
 * キャッシュ経由で使い回しても、購読はインスタンス単位で独立して積み増し/解除されるため
 * 通話をまたいだリスナーの取りこぼしや二重配信にはならない (nativeBridge.ts の
 * `onCallControlState` 契約コメント、NativeCallControl.ts のコンストラクタ/dispose() 参照)。
 */
const claimedTransports = new WeakMap<SelfmatrixNativeBridge, SelfmatrixNativeWidgetTransport>();

export function getOrClaimWidgetTransport(
  bridge: SelfmatrixNativeBridge
): SelfmatrixNativeWidgetTransport {
  const cached = claimedTransports.get(bridge);
  if (cached) return cached;

  const transport = bridge.claimWidgetTransport();
  claimedTransports.set(bridge, transport);
  return transport;
}
