import { MatrixClient, Room } from 'matrix-js-sdk';
import { Widget } from 'matrix-widget-api';
import { CallEmbed } from './CallEmbed';
import { CallControlState } from './CallControlState';
import { ElementWidgetActions } from './types';
import i18n from '../../i18n';

// SelfMatrix: 通話 UI 全体ポップアウト (roadmap Phase 2b UI 合意 v1.4 ③)。
// spike/call-popout で技術検証済みの方式を現行 CallEmbed に合わせて移植したもの。
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
 * ブラウザにブロックされた場合は null を返す。
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
    doc.body.style.position = 'relative';

    // widget の iframe がロードされるまで無地になるのを避けるため、先に軽いプレースホルダーを描画する。
    // body を position:relative にし、プレースホルダーを absolute で全面に重ねておくことで、
    // 後から append される iframe (position 未指定、通常フローで body 先頭から height:100%) が
    // 視覚的にその上に来る。iframe のロード完了 (onload) でプレースホルダーは不要になるため除去する。
    const placeholder = doc.createElement('div');
    placeholder.textContent = i18n.t('call.popped_out.connecting');
    placeholder.style.position = 'absolute';
    placeholder.style.inset = '0';
    placeholder.style.display = 'flex';
    placeholder.style.alignItems = 'center';
    placeholder.style.justifyContent = 'center';
    placeholder.style.color = '#e3e3e8';
    placeholder.style.fontFamily = 'sans-serif';
    doc.body.append(placeholder);

    super(mx, room, widget, doc.body, initialControlState, doc);

    this.iframe.style.position = 'relative';
    const removePlaceholder = () => placeholder.remove();
    this.iframe.addEventListener('load', removePlaceholder);
    this.popoutDisposables.push(() => this.iframe.removeEventListener('load', removePlaceholder));

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

  /**
   * SelfMatrix fix (敵対的レビュー FIX-1): window.open は同名 target
   * (POPUP_TARGET) だと既存ウィンドウを返すため、popoutCall が(誤って)
   * 二重実行されると複数の CallPopout インスタンスが同一 popup を共有しうる。
   * その場合、古い方の dispose() が生きている方の通話ウィンドウを巻き添えで
   * 閉じてしまわないよう、「popup の document に自分の iframe がまだ属して
   * いる場合のみ」close する所有権ガードを入れる。popup が既に閉じられて
   * いるか cross-window アクセスで例外が出る場合は自分の物とみなして close
   * を試みる (閉じる操作自体は既に無害)。
   */
  private ownsPopup(): boolean {
    try {
      if (this.popup.closed) return true;
      return this.popup.document.contains(this.iframe);
    } catch (e) {
      // クロスウィンドウアクセスで例外が起きるケース(通常は起き得ないが保険)
      console.error('Error checking call popout ownership:', e);
      return true;
    }
  }

  public dispose(): void {
    this.popoutDisposables.forEach((dispose) => dispose());
    this.popoutDisposables.length = 0;

    const owns = this.ownsPopup();

    try {
      super.dispose();
    } catch (e) {
      // ポップアップが既に閉じられていると iframe の除去などが失敗しうる
      console.error('Error disposing call popout:', e);
    }

    if (owns && !this.popup.closed) {
      this.popup.close();
    }
  }
}
