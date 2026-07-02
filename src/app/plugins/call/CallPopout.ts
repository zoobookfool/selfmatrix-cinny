import { MatrixClient, Room } from 'matrix-js-sdk';
import { Widget } from 'matrix-widget-api';
import { CallEmbed } from './CallEmbed';
import { CallControlState } from './CallControlState';
import { ElementWidgetActions } from './types';

// SPIKE(ポップアウト): 通話画面の別ウィンドウ化の技術検証 (roadmap Phase 2b / ui-design-notes.md)。
//
// iframe の DOM 移動はブラウザ仕様上リロードを伴うため「セッション維持での移動」は不可。
// 代わりに、ユーザー操作で開いたポップアップ内に新しい iframe を作り、短時間の再接続で再 join する。
//
// widget (element-call) 側の matrix-widget-api は window.parent 固定で postMessage するため、
// ポップアップ内の iframe からのメッセージはポップアップ window に届く。それをメインウィンドウへ
// 中継 (relay) することで、メインウィンドウ側の ClientWidgetApi / CallWidgetDriver を無改造で使う。
// メインウィンドウ → widget 方向は iframe.contentWindow へ直接届くので中継不要。

const POPUP_TARGET = 'cinny_call_popout';
const POPUP_FEATURES = 'popup=yes,width=960,height=640';

/**
 * ポップアップはユーザー操作 (クリック) の同期スタック内で開かないとブロックされるため、
 * 離脱/再joinの非同期処理より先にこれを呼んで空のウィンドウを確保しておく。
 */
export const openCallPopoutWindow = (): Window | null =>
  window.open('', POPUP_TARGET, POPUP_FEATURES);

export class CallPopout extends CallEmbed {
  private readonly popup: Window;

  private readonly popoutDisposables: Array<() => void> = [];

  constructor(
    mx: MatrixClient,
    room: Room,
    widget: Widget,
    popup: Window,
    initialControlState?: CallControlState
  ) {
    const doc = popup.document;
    doc.title = `Call — ${room.name}`;
    doc.documentElement.style.height = '100%';
    doc.body.style.height = '100%';
    doc.body.style.margin = '0';
    doc.body.style.background = '#17191c';

    super(mx, room, widget, doc.body, initialControlState);

    this.popup = popup;

    // widget → window.parent(=ポップアップ) へのメッセージをメインウィンドウへ中継する。
    // PostmessageTransport は origin/source を検証しない (strictOriginCheck 既定 false) ため、
    // 再ポストしたメッセージはメインウィンドウ側 ClientWidgetApi にそのまま受理される。
    const relay = (ev: MessageEvent) => {
      if (ev.source !== this.iframe.contentWindow) return;
      if (!ev.data || typeof ev.data !== 'object' || !('api' in ev.data)) return;
      window.postMessage(ev.data, window.location.origin);
    };
    popup.addEventListener('message', relay);
    this.popoutDisposables.push(() => popup.removeEventListener('message', relay));

    // ユーザーがポップアップを直接閉じた場合は widget からの Close を装って
    // 既存の hangup フロー (CallEmbedProvider の useCallHangupEvent → dispose) に乗せる
    const closeWatch = window.setInterval(() => {
      if (popup.closed) this.onPopupClosed();
    }, 500);
    this.popoutDisposables.push(() => window.clearInterval(closeWatch));

    // メインウィンドウが閉じる/リロードされると driver (matrix-js-sdk) を失うので道連れにする
    const onPageHide = () => popup.close();
    window.addEventListener('pagehide', onPageHide);
    this.popoutDisposables.push(() => window.removeEventListener('pagehide', onPageHide));
  }

  private onPopupClosed(): void {
    this.popoutDisposables.forEach((dispose) => dispose());
    this.popoutDisposables.length = 0;

    this.call.emit(
      `action:${ElementWidgetActions.Close}`,
      new CustomEvent(`action:${ElementWidgetActions.Close}`, { detail: {} })
    );
  }

  public dispose(): void {
    this.popoutDisposables.forEach((dispose) => dispose());
    this.popoutDisposables.length = 0;

    try {
      super.dispose();
    } catch (e) {
      // ポップアップが既に閉じられていると iframe の除去などが失敗しうる
      console.error('Error disposing call popout:', e);
    }

    if (!this.popup.closed) {
      this.popup.close();
    }
  }
}
