import {
  createContext,
  RefObject,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { MatrixClient, Room } from 'matrix-js-sdk';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  CallEmbed,
  CallPopout,
  ElementCallThemeKind,
  ElementWidgetActions,
  openCallPopoutWindow,
  useClientWidgetApiEvent,
} from '../plugins/call';
import { useMatrixClient } from './useMatrixClient';
import { ThemeKind, useTheme } from './useTheme';
import { callEmbedAtom } from '../state/callEmbed';
import { mDirectAtom } from '../state/mDirectList';
import { useResizeObserver } from './useResizeObserver';
import { CallControlState } from '../plugins/call/CallControlState';
import { useCallMembersChange, useCallSession } from './useCall';
import { CallPreferences } from '../state/callPreferences';
import { NativeCallEmbed } from '../plugins/call/native/NativeCallEmbed';
import {
  getSelfmatrixNativeBridge,
  hasSelfmatrixNativeBridge,
} from '../plugins/call/native/nativeBridge';

const CallEmbedContext = createContext<CallEmbed | undefined>(undefined);

export const CallEmbedContextProvider = CallEmbedContext.Provider;

export const useCallEmbed = (): CallEmbed | undefined => {
  const callEmbed = useContext(CallEmbedContext);

  return callEmbed;
};

const CallEmbedRefContext = createContext<RefObject<HTMLDivElement> | undefined>(undefined);
export const CallEmbedRefContextProvider = CallEmbedRefContext.Provider;
export const useCallEmbedRef = (): RefObject<HTMLDivElement> => {
  const ref = useContext(CallEmbedRefContext);
  if (!ref) {
    throw new Error('CallEmbedRef is not provided!');
  }
  return ref;
};

export const createCallEmbed = (
  mx: MatrixClient,
  room: Room,
  dm: boolean,
  themeKind: ElementCallThemeKind,
  container: HTMLElement,
  pref?: CallPreferences
): CallEmbed => {
  const rtcSession = mx.matrixRTC.getRoomSession(room);
  const ongoing = rtcSession.memberships.length > 0;

  const intent = CallEmbed.getIntent(dm, ongoing, false);
  const widget = CallEmbed.getWidget(mx, room, intent, themeKind);
  const controlState = pref && new CallControlState(pref.microphone, false, pref.sound);

  // SelfMatrix M1 step 3a: ネイティブシェル (window.selfmatrixNative) 検出時は
  // WebContentsView 経由の NativeCallEmbed を使う。NativeCallEmbed は設計上
  // (design/native-widget-transport.md §2.3) CallEmbed を継承しない別クラスだが、
  // hooks/Provider が使う公開 API (call/room/roomId/joined/control/setTheme/hangup/
  // listenAction/listenEvent/dispose) を同一シグネチャで提供するため、ここでのみ
  // 型を合わせて返す。呼び出し元 (createCallEmbed の他の利用箇所、useCallPopout/
  // useCallPopin 等) は一切変更していない。
  //
  // SelfMatrix M2 (Fable sec-critical #1 解消、web ビルドの native 分岐 tree-shake):
  // この分岐全体を `import.meta.env.VITE_SELFMATRIX_NATIVE` (build:native スクリプト、
  // .env.native 経由のビルド時定数) でゲートする。web ビルドではこの定数が静的に
  // falsy へ置換されるため、`NativeCallEmbed` への `new` 呼び出し (このモジュールで
  // `NativeCallEmbed` を実行時に参照する唯一の箇所) が dead code になり、
  // `NativeCallEmbed`/`NativeCallControl`/`NativeIframeShim`/`nativeBridge.ts` の
  // native 固有コードがバンドラの tree-shake で dist から除去される。
  if (import.meta.env.VITE_SELFMATRIX_NATIVE) {
    const nativeBridge = getSelfmatrixNativeBridge();
    if (nativeBridge) {
      const nativeEmbed = new NativeCallEmbed(mx, room, widget, nativeBridge, controlState);
      return nativeEmbed as unknown as CallEmbed;
    }
  }

  const embed = new CallEmbed(mx, room, widget, container, controlState);

  return embed;
};

export const useCallStart = (dm = false) => {
  const mx = useMatrixClient();
  const theme = useTheme();
  const setCallEmbed = useSetAtom(callEmbedAtom);
  const callEmbedRef = useCallEmbedRef();

  const startCall = useCallback(
    (room: Room, pref?: CallPreferences) => {
      const container = callEmbedRef.current;
      if (!container) {
        throw new Error('Failed to start call, No embed container element found!');
      }
      const callEmbed = createCallEmbed(mx, room, dm, theme.kind, container, pref);

      setCallEmbed(callEmbed);
    },
    [mx, dm, theme, setCallEmbed, callEmbedRef]
  );

  return startCall;
};

// 通話中の embed を別ウィンドウへ移す。
// iframe の DOM 移動はリロードを伴い widget-api の transport も張り替え不能なため、
// 「現在の通話から離脱 → ポップアップ内の新規 iframe で再 join」という短時間の再接続方式をとる。
export const useCallPopout = () => {
  const mx = useMatrixClient();
  const theme = useTheme();
  const directs = useAtomValue(mDirectAtom);
  const setCallEmbed = useSetAtom(callEmbedAtom);
  const popoutInFlightRef = useRef(false);

  const popoutCall = useCallback(
    async (embed: CallEmbed) => {
      // SelfMatrix M1 step 3a レビュー FIX-A: ネイティブ版の窓移動は M3 で
      // WebContentsView 再親子付けに置き換わる (design §2.3)。それまで native では
      // popout を提供しない。
      // SelfMatrix M2: 同じ VITE_SELFMATRIX_NATIVE 定数でもゲートする (nativeBridge.ts
      // 側の内部ゲートと二重の防御。web ビルドでは常に false)。
      if (import.meta.env.VITE_SELFMATRIX_NATIVE && hasSelfmatrixNativeBridge()) {
        return;
      }

      // SelfMatrix fix (敵対的レビュー FIX-1): 既にポップアウト済み、または
      // ポップアウト処理が進行中の場合は再入しない。popoutCall の二重実行は
      // window.open が同名 target で既存ウィンドウを返すことと相まって、
      // 複数の CallPopout が同一 popup を共有する原因になる。
      if (embed instanceof CallPopout || popoutInFlightRef.current) {
        return;
      }
      popoutInFlightRef.current = true;

      try {
        // ポップアップはクリックの同期スタック内で開かないとブロックされる
        const popup = openCallPopoutWindow();
        if (!popup) {
          throw new Error('popout-blocked');
        }

        const { room } = embed;
        const controlState = embed.control.getState();
        const dm = directs.has(room.roomId);

        // LiveKit は同一 identity の二重参加で既存セッションを切断するため、
        // 離脱完了 (widget からの Close) を待ってから再 join する
        await new Promise<void>((resolve) => {
          const cleanup: Array<() => void> = [];
          const finish = () => {
            cleanup.forEach((dispose) => dispose());
            cleanup.length = 0;
            resolve();
          };
          cleanup.push(embed.listenAction(ElementWidgetActions.Close, finish));
          cleanup.push(embed.listenAction(ElementWidgetActions.HangupCall, finish));
          const timeout = window.setTimeout(finish, 5000);
          cleanup.push(() => window.clearTimeout(timeout));
          embed.hangup();
        });
        setCallEmbed(undefined);

        const rtcSession = mx.matrixRTC.getRoomSession(room);
        const ongoing = rtcSession.memberships.length > 0;
        const intent = CallEmbed.getIntent(dm, ongoing, false);
        const themeKind: ElementCallThemeKind = theme.kind === ThemeKind.Dark ? 'dark' : 'light';
        const widget = CallEmbed.getWidget(mx, room, intent, themeKind);

        const popout = new CallPopout(mx, room, widget, popup, controlState);
        setCallEmbed(popout);
      } finally {
        popoutInFlightRef.current = false;
      }
    },
    [mx, theme, directs, setCallEmbed]
  );

  return popoutCall;
};

// popoutCall の逆。ポップアウト先から離脱 → ポップアップを閉じる → メインの container で
// 通常の CallEmbed を再生成する。
export const useCallPopin = () => {
  const mx = useMatrixClient();
  const theme = useTheme();
  const directs = useAtomValue(mDirectAtom);
  const setCallEmbed = useSetAtom(callEmbedAtom);
  const callEmbedRef = useCallEmbedRef();

  const popinCall = useCallback(
    async (embed: CallEmbed) => {
      // SelfMatrix M1 step 3a レビュー FIX-A: native では popin で web CallEmbed を
      // 構築しない防御ガード。popout 自体を native では提供しない (useCallPopout の
      // ガード参照) ため通常ここに到達しないはずだが、防御的に同様のガードを置く。
      // SelfMatrix M2: 同じ VITE_SELFMATRIX_NATIVE 定数でもゲートする (web ビルドでは常に false)。
      if (import.meta.env.VITE_SELFMATRIX_NATIVE && hasSelfmatrixNativeBridge()) {
        return;
      }

      const container = callEmbedRef.current;
      if (!container) {
        throw new Error('Failed to pop in call, No embed container element found!');
      }

      const { room } = embed;
      const controlState = embed.control.getState();
      const dm = directs.has(room.roomId);

      await new Promise<void>((resolve) => {
        const cleanup: Array<() => void> = [];
        const finish = () => {
          cleanup.forEach((dispose) => dispose());
          cleanup.length = 0;
          resolve();
        };
        cleanup.push(embed.listenAction(ElementWidgetActions.Close, finish));
        cleanup.push(embed.listenAction(ElementWidgetActions.HangupCall, finish));
        const timeout = window.setTimeout(finish, 5000);
        cleanup.push(() => window.clearTimeout(timeout));
        embed.hangup();
      });
      setCallEmbed(undefined);

      const rtcSession = mx.matrixRTC.getRoomSession(room);
      const ongoing = rtcSession.memberships.length > 0;
      const intent = CallEmbed.getIntent(dm, ongoing, false);
      const themeKind: ElementCallThemeKind = theme.kind === ThemeKind.Dark ? 'dark' : 'light';
      const widget = CallEmbed.getWidget(mx, room, intent, themeKind);

      const callEmbed = new CallEmbed(mx, room, widget, container, controlState);
      setCallEmbed(callEmbed);
    },
    [mx, theme, directs, setCallEmbed, callEmbedRef]
  );

  return popinCall;
};

export const useCallJoined = (embed?: CallEmbed): boolean => {
  const [joined, setJoined] = useState(embed?.joined ?? false);

  useClientWidgetApiEvent(
    embed?.call,
    ElementWidgetActions.JoinCall,
    useCallback(() => {
      setJoined(true);
    }, [])
  );

  useEffect(() => {
    if (!embed) {
      setJoined(false);
    }
  }, [embed]);

  return joined;
};

export const useCallHangupEvent = (embed: CallEmbed, callback: () => void) => {
  useClientWidgetApiEvent(embed.call, ElementWidgetActions.HangupCall, callback);
  useClientWidgetApiEvent(embed.call, ElementWidgetActions.Close, callback);
};

export const useCallMemberSoundSync = (embed: CallEmbed) => {
  const callSession = useCallSession(embed.room);
  useCallMembersChange(
    callSession,
    useCallback(() => embed.control.applySound(), [embed])
  );
};

export const useCallThemeSync = (embed: CallEmbed) => {
  const theme = useTheme();

  useEffect(() => {
    const name: ElementCallThemeKind = theme.kind === ThemeKind.Dark ? 'dark' : 'light';

    embed.setTheme(name);
  }, [theme.kind, embed]);
};

// SelfMatrix M2 bounds sync (Fable 全体レビュー arch-major 解消): この CallView が実際に表示
// している通話 (roomId) を渡させる。callEmbed はアプリ全体で単一のグローバル atom
// (state/callEmbed.ts) であり、CallView 自体は「別 room で進行中の通話がある」場合にも
// マウントされ得る (features/room/Room.tsx の callView 判定式:
// `callEmbed?.roomId === room.roomId || room.isCallRoom() || callMembers.length > 0` —
// 自分がまだ参加していない他人の通話がある room を見ているだけでも CallView は出る)。roomId が
// 一致しない CallView インスタンスにまで native 転送させると、無関係な room のコンテナ矩形を
// 別 room で実際にアクティブな通話の view へ push してしまう。web 経路 (下記 4 行のスタイル適用)
// はこの引数を使わず、これまでどおり無条件に動く — 1 バイトも変えていない。
export const useCallEmbedPlacementSync = (
  containerViewRef: RefObject<HTMLDivElement>,
  roomId: string
): void => {
  const callEmbedRef = useCallEmbedRef();
  const callEmbed = useCallEmbed();

  // native では createCallEmbed() が hasSelfmatrixNativeBridge() のときだけ NativeCallEmbed を
  // 返す (このファイル冒頭の createCallEmbed() 参照) ため、hasSelfmatrixNativeBridge() が true な
  // 環境で callEmbed が存在すれば、それは必ず NativeCallEmbed である。useCallPopout/useCallPopin が
  // 同じ前提 (hasSelfmatrixNativeBridge() の真偽だけを見る) で native 分岐しているのと同じ簡略化。
  // SelfMatrix M2: 同じ VITE_SELFMATRIX_NATIVE 定数でもゲートする (web ビルドでは常に undefined
  // に畳み込まれ、`callEmbed as unknown as NativeCallEmbed` の型キャストは実行時コードを
  // 生成しない — このファイルの `NativeCallEmbed` 実体参照は createCallEmbed() の dead 分岐
  // 内の `new NativeCallEmbed(...)` のみ)。
  const nativeEmbedForThisRoom =
    import.meta.env.VITE_SELFMATRIX_NATIVE &&
    hasSelfmatrixNativeBridge() &&
    callEmbed &&
    callEmbed.roomId === roomId
      ? (callEmbed as unknown as NativeCallEmbed)
      : undefined;

  const syncCallEmbedPlacement = useCallback(() => {
    const embedEl = callEmbedRef.current;
    const container = containerViewRef.current;
    if (!embedEl || !container) return;

    const rect = container.getBoundingClientRect();
    embedEl.style.top = `${rect.top}px`;
    embedEl.style.left = `${rect.left}px`;
    embedEl.style.width = `${rect.width}px`;
    embedEl.style.height = `${rect.height}px`;

    // native 経路の追加配線。過剰送信の抑制 (同値スキップ + requestAnimationFrame まとめ) は
    // 送信元である NativeCallEmbed.setPlacement() 側の責務 (詳細は同メソッドのコメント参照)。
    nativeEmbedForThisRoom?.setPlacement(rect);
  }, [callEmbedRef, containerViewRef, nativeEmbedForThisRoom]);

  useResizeObserver(
    syncCallEmbedPlacement,
    useCallback(() => containerViewRef.current, [containerViewRef])
  );

  // この CallView (containerViewRef) がこの通話にとってもう「表示すべき場所」ではなくなったとき
  // (アンマウント、または別 room を見ている間に対象の通話が切り替わって nativeEmbedForThisRoom が
  // 変わった/居なくなったとき) にシェルへ null を送り、「call view を隠す/レイアウト外」を明示する
  // (nativeBridge.ts の setCallViewBounds() 契約参照)。
  useEffect(
    () => () => {
      nativeEmbedForThisRoom?.setPlacement(null);
    },
    [nativeEmbedForThisRoom]
  );
};
