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
import { CallViewPlacement, NativeCallEmbed } from '../plugins/call/native/NativeCallEmbed';
import {
  getSelfmatrixNativeBridge,
  hasSelfmatrixNativeBridge,
} from '../plugins/call/native/nativeBridge';
import { getCameraFeaturePolicy } from '../plugins/call/cameraFeature';
import { useSetting } from '../state/hooks/settings';
import { settingsAtom } from '../state/settings';

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
  pref?: CallPreferences,
  cameraEnabled = false
): CallEmbed => {
  const rtcSession = mx.matrixRTC.getRoomSession(room);
  const ongoing = rtcSession.memberships.length > 0;

  const intent = CallEmbed.getIntent(dm, ongoing, false);
  const widget = CallEmbed.getWidget(mx, room, intent, themeKind, cameraEnabled);
  const cameraPolicy = getCameraFeaturePolicy(cameraEnabled, pref?.video);
  const controlState =
    pref && new CallControlState(pref.microphone, cameraPolicy.initialVideoEnabled, pref.sound);

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
  const [cameraEnabled] = useSetting(settingsAtom, 'cameraEnabled');

  const startCall = useCallback(
    (room: Room, pref?: CallPreferences) => {
      const container = callEmbedRef.current;
      if (!container) {
        throw new Error('Failed to start call, No embed container element found!');
      }
      const callEmbed = createCallEmbed(mx, room, dm, theme.kind, container, pref, cameraEnabled);

      setCallEmbed(callEmbed);
    },
    [mx, dm, theme, setCallEmbed, callEmbedRef, cameraEnabled]
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
  const [cameraEnabled] = useSetting(settingsAtom, 'cameraEnabled');

  const popoutCall = useCallback(
    async (embed: CallEmbed) => {
      // SelfMatrix M1 step 3a レビュー FIX-A: ネイティブ版の窓移動は「離脱 → 別窓で再 join」の
      // 再接続方式ではなく、WebContentsView の無再接続な再親子付け (design §2.3) を使う。
      // M3 step 4 でその経路 (NativeCallEmbed.popout()、CallControls.tsx の native 分岐) が
      // 実装されたため、native の ⧉ ボタンは *この* フック (useCallPopout) を経由しない
      // (CallControls.tsx 参照)。この early return は、native 分岐の配線ミス等で誤って
      // この web 用フックが呼ばれてしまった場合に web の再接続方式 (callEmbedAtom の
      // 差し替え) が native の通話を巻き込んで切断してしまわないための防御として残す。
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
        const widget = CallEmbed.getWidget(mx, room, intent, themeKind, cameraEnabled);

        const popout = new CallPopout(mx, room, widget, popup, controlState);
        setCallEmbed(popout);
      } finally {
        popoutInFlightRef.current = false;
      }
    },
    [mx, theme, directs, setCallEmbed, cameraEnabled]
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
  const [cameraEnabled] = useSetting(settingsAtom, 'cameraEnabled');

  const popinCall = useCallback(
    async (embed: CallEmbed) => {
      // SelfMatrix M1 step 3a レビュー FIX-A: native では popin で web CallEmbed を
      // 構築しない防御ガード。M3 step 4 で native の「メインに戻す」導線は
      // NativeCallEmbed.popin() (CallControls.tsx の native 分岐) を経由するようになり、
      // このフック (useCallPopin) は通常ここに到達しないが、防御的に同様のガードを置く
      // (useCallPopout の同種コメント参照)。
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
      const widget = CallEmbed.getWidget(mx, room, intent, themeKind, cameraEnabled);

      const callEmbed = new CallEmbed(mx, room, widget, container, controlState);
      setCallEmbed(callEmbed);
    },
    [mx, theme, directs, setCallEmbed, callEmbedRef, cameraEnabled]
  );

  return popinCall;
};

/**
 * SelfMatrix M3 step 4 (design/m3-window-ux.md §2 サブステップ 4/§3-5): native の call view が
 * 現在どちらの窓に attach されているか ("main" | "window" | "none") を React state として
 * 購読する。web、または native 未検出のときは常に `undefined` を返す — 呼び出し元
 * (CallControls.tsx) はこれで web/native を判別できる。
 *
 * 別窓をユーザーが X ボタンで閉じると cinny 側の操作を伴わずに "main" へ戻る push が来る
 * (design §3-5) ため、この state は `NativeCallEmbed.onCallViewPlacementChange()` の購読だけで
 * 追従させる (楽観的更新は行わない — push が実状態そのもの)。
 *
 * SelfMatrix M2 tree-shake との整合: native 検出ゲート (`import.meta.env.VITE_SELFMATRIX_NATIVE
 * && hasSelfmatrixNativeBridge()`) は `useCallEmbedPlacementSync` の `nativeEmbedForThisRoom`
 * と同様、**この関数自身のスコープ内**で行う (呼び出し元から渡された値を受け取るだけにしない)。
 * web ビルドでは定数が静的に false へ畳み込まれるため、ゲートと `NativeCallEmbed` 参照が
 * 同一スコープ内にあることでバンドラがこの関数全体を通して dead code として畳み込める
 * (呼び出し元で先にゲート判定してから引数として渡す形にすると、この関数のコンパイル結果は
 * 引数の実行時 truthiness にしか依存できず、`.getCallViewPlacement()`/
 * `.onCallViewPlacementChange()` の呼び出し自体が web dist に残ってしまう — 実装中に
 * `npm run build` の dist を grep して実際にこの差を確認した)。
 */
export const useNativeCallViewPlacement = (
  embed: CallEmbed | undefined
): CallViewPlacement | undefined => {
  const nativeEmbed =
    import.meta.env.VITE_SELFMATRIX_NATIVE && hasSelfmatrixNativeBridge() && embed
      ? (embed as unknown as NativeCallEmbed)
      : undefined;

  const [placement, setPlacement] = useState<CallViewPlacement | undefined>(() =>
    nativeEmbed?.getCallViewPlacement()
  );

  useEffect(() => {
    if (!nativeEmbed) {
      setPlacement(undefined);
      return undefined;
    }
    // onCallViewPlacementChange() は購読直後に現在値を同期 replay するため、ここで改めて
    // getCallViewPlacement() を読む必要はない (NativeCallEmbed.ts のコメント参照)。
    return nativeEmbed.onCallViewPlacementChange(setPlacement);
  }, [nativeEmbed]);

  return placement;
};

/**
 * SelfMatrix M3 step 4: ⧉ ボタン (native 分岐、CallControls.tsx) のクリックハンドラ。
 * `placement` (`useNativeCallViewPlacement()` の戻り値) が `'window'` なら popin()、それ以外なら
 * popout() を呼ぶ。web、または native 未検出のときは何もしない no-op を返す (呼び出し元が
 * web/native で条件分岐せずそのまま onClick に渡せるようにするため)。
 *
 * `useNativeCallViewPlacement()` と同じ理由 (このファイル上のコメント参照) で native 検出ゲートは
 * **この関数自身のスコープ内**で完結させている — CallControls.tsx 側で先にゲート判定した
 * `NativeCallEmbed` 参照を引数として受け取る形にはしない。
 */
export const useNativeCallPopoutToggle = (
  embed: CallEmbed | undefined,
  placement: CallViewPlacement | undefined
): (() => Promise<void>) => {
  const nativeEmbed =
    import.meta.env.VITE_SELFMATRIX_NATIVE && hasSelfmatrixNativeBridge() && embed
      ? (embed as unknown as NativeCallEmbed)
      : undefined;

  return useCallback(() => {
    if (!nativeEmbed) return Promise.resolve();
    return placement === 'window' ? nativeEmbed.popin() : nativeEmbed.popout();
  }, [nativeEmbed, placement]);
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
