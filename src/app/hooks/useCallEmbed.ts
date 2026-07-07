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

export const useCallEmbedPlacementSync = (containerViewRef: RefObject<HTMLDivElement>): void => {
  const callEmbedRef = useCallEmbedRef();

  const syncCallEmbedPlacement = useCallback(() => {
    const embedEl = callEmbedRef.current;
    const container = containerViewRef.current;
    if (!embedEl || !container) return;

    const rect = container.getBoundingClientRect();
    embedEl.style.top = `${rect.top}px`;
    embedEl.style.left = `${rect.left}px`;
    embedEl.style.width = `${rect.width}px`;
    embedEl.style.height = `${rect.height}px`;
  }, [callEmbedRef, containerViewRef]);

  useResizeObserver(
    syncCallEmbedPlacement,
    useCallback(() => containerViewRef.current, [containerViewRef])
  );
};
