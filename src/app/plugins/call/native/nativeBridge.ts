/**
 * SelfMatrix M1 step 3a — ネイティブシェル (selfmatrix-desktop 相当。現状は
 * selfmatrix-workspace/native-prototype) が cinny の window に公開する
 * `window.selfmatrixNative` の型定義と検出ヘルパ。
 *
 * この型は「cinny 側がシェルに要求する契約」であり、シェル側の実装は
 * まだこの形に揃っていない (step 3b で合わせる想定)。現行 prototype
 * (native-prototype/src/shell-preload.cjs) との既知の差分:
 *   - prototype の claimWidgetTransport() は
 *     { sendToView, notifyWidgetHostReady, callControlInvoke } を返し、
 *     通話 View の起動/停止は window.selfmatrixNative 直下の
 *     ensureCallView() / detachCallView() / attachCallView() という
 *     別チャンネル (URL 引数なし、静的な /widget-config.json を読む) で行っていた。
 *   - この契約は通話 1 本ごとに widget の完成 URL が異なる (room/user/intent 依存)
 *     cinny の実運用に合わせて、URL 引数付きの openCallView(completeWidgetUrl) /
 *     closeCallView() を claim 済みトランスポートに統合した形に変更している。
 *     shell 側の対応は step 3b のスコープ。
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
  openCallView(completeWidgetUrl: string): Promise<void>;

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
 * `window.selfmatrixNative` を返す。通常のブラウザ/web 版 cinny では常に undefined。
 * createCallEmbed() の native 分岐の検出に使う。
 */
export function getSelfmatrixNativeBridge(): SelfmatrixNativeBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.selfmatrixNative;
}
