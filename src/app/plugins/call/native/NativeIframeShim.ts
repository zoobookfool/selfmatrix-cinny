import { SelfmatrixNativeWidgetTransport } from './nativeBridge';

/**
 * design/native-widget-transport.md §2.1/§3 の iframe シム。
 *
 * `ClientWidgetApi` のコンストラクタ (matrix-widget-api `src/ClientWidgetApi.ts`) が
 * 実際に読むのは以下の 3 点のみ (全 1950 行中 `iframe` の出現は計 4 行、design §1.1):
 *   - `iframe.contentWindow` の truthy チェック (無いと "No iframe supplied" で throw)
 *   - `iframe.contentWindow.postMessage(message, targetOrigin)` — host→widget 送信
 *   - `iframe.addEventListener('load', ...)` — cinny は widget を
 *     `waitForIframeLoad: false` で生成するため (`CallEmbed.getWidget()`)、'load' が
 *     一度も発火しなくても実害がない (capability 交渉の実トリガーは widget からの
 *     `content_loaded` action であり transport 経由 = iframe 非依存)
 *
 * 受信 (widget→host) はこのシムの関与しないところで完結する: `PostmessageTransport` の
 * `inboundWindow` は常に `globalThis` に固定されており、シェル preload が call view から
 * 受け取ったメッセージを cinny の実 window へ `window.postMessage` で折り返すことで、
 * `ClientWidgetApi` 自身の 'message' リスナーが本物の DOM イベントとして受け取る
 * (nativeBridge.ts の型コメント、design §2.1 参照)。そのためこのシムは
 * `removeEventListener` を含め実際の DOM イベント配送は一切行わない — 呼ばれても
 * 記録するだけの no-op で足りる。
 *
 * 戻り値は `HTMLIFrameElement` の実インターフェースをほぼ満たさない最小オブジェクトのため、
 * `as unknown as HTMLIFrameElement` キャストが必要 (design §2.1 で明示的に許容された手法)。
 * 実行時に `ClientWidgetApi` から使われるのは上記 3 プロパティのみであることをコード精読で
 * 確認済み。
 */
export function createNativeIframeShim(
  transport: Pick<SelfmatrixNativeWidgetTransport, 'sendToView'>
): HTMLIFrameElement {
  const loadListeners = new Map<string, EventListenerOrEventListenerObject>();

  const shim = {
    contentWindow: {
      // ClientWidgetApi 内部の PostmessageTransport は
      // `this.transportWindow.postMessage(message, this.targetOrigin)` の 2 引数で呼ぶ
      // (matrix-widget-api `src/transport/PostmessageTransport.ts`)。targetOrigin は
      // 素通しルータ (main プロセス、通話 1 本につき固定の 1 経路) が既に転送先を
      // 一意に決めているため、ここでは無視してよい (JS は宣言より多い引数を渡されても
      // 無視するだけなので、2 引数目を意図的に宣言しない)。
      postMessage(message: unknown): void {
        transport.sendToView(message);
      },
    },
    addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
      // 'load' 以外は ClientWidgetApi から登録されない想定。waitForIframeLoad:false
      // 前提のため、記録だけして実際に発火させることはない。
      loadListeners.set(type, listener);
    },
    removeEventListener(type: string): void {
      loadListeners.delete(type);
    },
  };

  return shim as unknown as HTMLIFrameElement;
}
