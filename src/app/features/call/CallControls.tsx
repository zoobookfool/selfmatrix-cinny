import React, { MouseEventHandler, useCallback, useRef, useState } from 'react';
import {
  Box,
  Button,
  color,
  config,
  Icon,
  IconButton,
  Icons,
  Menu,
  MenuItem,
  PopOut,
  RectCords,
  Spinner,
  Text,
  Tooltip,
  TooltipProvider,
  toRem,
} from 'folds';
import FocusTrap from 'focus-trap-react';
import { useTranslation } from 'react-i18next';
import { SequenceCard } from '../../components/sequence-card';
import * as css from './styles.css';
import {
  ChatButton,
  ControlDivider,
  MicrophoneButton,
  ScreenShareButton,
  SoundButton,
  VideoButton,
} from './Controls';
import { CallEmbed, useCallControlState } from '../../plugins/call';
import {
  useCallPopout,
  useNativeCallPopoutToggle,
  useNativeCallViewPlacement,
} from '../../hooks/useCallEmbed';
import { useResizeObserver } from '../../hooks/useResizeObserver';
import { stopPropagation } from '../../utils/keyboard';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';
import { hasSelfmatrixNativeBridge } from '../../plugins/call/native/nativeBridge';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';

type CallControlsProps = {
  callEmbed: CallEmbed;
};
export function CallControls({ callEmbed }: CallControlsProps) {
  const { t } = useTranslation();
  const controlRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(document.body.clientWidth < 500);

  useResizeObserver(
    useCallback(() => {
      const element = controlRef.current;
      if (!element) return;
      setCompact(element.clientWidth < 500);
    }, []),
    useCallback(() => controlRef.current, [])
  );

  const [cameraEnabled] = useSetting(settingsAtom, 'cameraEnabled');
  const { microphone, video, sound, screenshare, spotlight, emphasis } = useCallControlState(
    callEmbed.control
  );

  const [cords, setCords] = useState<RectCords>();

  const handleOpenMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setCords(evt.currentTarget.getBoundingClientRect());
  };

  const handleSpotlightClick = () => {
    callEmbed.control.toggleSpotlight();
    setCords(undefined);
  };

  const handleEmphasisClick = () => {
    callEmbed.control.toggleEmphasis();
    setCords(undefined);
  };

  const handleSettingsClick = () => {
    callEmbed.control.toggleSettings();
    setCords(undefined);
  };

  const handleMicrophoneToggle = useCallback(
    () => callEmbed.control.toggleMicrophone(),
    [callEmbed]
  );

  const handleVideoToggle = useCallback(() => callEmbed.control.toggleVideo(), [callEmbed]);

  const [hangupState, hangup] = useAsyncCallback(
    useCallback(() => callEmbed.hangup(), [callEmbed])
  );
  const exiting =
    hangupState.status === AsyncStatus.Loading || hangupState.status === AsyncStatus.Success;

  const popoutCall = useCallPopout();
  const [popoutState, popout] = useAsyncCallback(
    useCallback(() => popoutCall(callEmbed), [popoutCall, callEmbed])
  );
  const popouting = popoutState.status === AsyncStatus.Loading;
  const popoutBlocked = popoutState.status === AsyncStatus.Error;

  // SelfMatrix M2: web ビルドでは VITE_SELFMATRIX_NATIVE が静的に false へ畳み込まれるため
  // nativeShell は常に false (この式全体・後続の native 分岐が dead code として tree-shake
  // される、CallEmbed.ts createCallEmbed() 等と同じパターン)。
  const nativeShell =
    Boolean(import.meta.env.VITE_SELFMATRIX_NATIVE) && hasSelfmatrixNativeBridge();

  // SelfMatrix M3 step 4 (design/m3-window-ux.md §2 サブステップ 4): ⧉ ボタンを native でも
  // 描画する (M1 step 3a レビュー FIX-A の非描画ガードを撤廃)。native では web の
  // useCallPopout/useCallPopin (離脱→別窓再 join の再接続方式) ではなく、claim 済み transport
  // 経由の無再接続な再親子付け (NativeCallEmbed.popout()/popin()) を使う。
  //
  // 別窓をユーザーが X で閉じると cinny 側の操作なしに 'main' へ戻る push が来る (design §3-5)
  // ため、ボタンの見た目/挙動はこの購読済み state だけで決める (クリック時の楽観的トグルは
  // しない — push が実状態そのもの)。native 検出ゲート・NativeCallEmbed 参照
  // (getOrClaimWidgetTransport() 経由の claim 済み transport 呼び出し) はどちらも
  // useCallEmbed.ts 側のフック自身のスコープ内に閉じ込めてある (このコンポーネントには
  // NativeCallEmbed の値としての参照を一切持ち込まない) — 呼び出し元をまたいでゲート判定を
  // 使い回すと、tree-shake 時に native 分岐が web dist から確実には畳み込まれなくなるため
  // (実装中に `npm run build` の dist を grep して実際にこの差を確認した)。
  const nativePlacement = useNativeCallViewPlacement(callEmbed);
  const nativePopin = nativeShell && nativePlacement === 'window';
  const triggerNativePopout = useNativeCallPopoutToggle(callEmbed, nativePlacement);

  const [nativePopoutState, runNativePopoutAction] = useAsyncCallback(triggerNativePopout);
  const nativePopoutPending = nativePopoutState.status === AsyncStatus.Loading;

  // web 経路 (nativeShell === false) では以下は全て元の値と一致する:
  // popoutButtonTestId = 'call_popout' / popoutButtonLabel = t('call.controls.popout') /
  // popoutButtonPending = popouting / popoutButtonOnClick = popout / popoutButtonIcon = External。
  const popoutButtonTestId = nativePopin ? 'call_popin' : 'call_popout';
  const popoutButtonLabel = nativePopin ? t('call.controls.popin') : t('call.controls.popout');
  const popoutButtonPending = nativeShell ? nativePopoutPending : popouting;
  const popoutButtonOnClick = nativeShell ? runNativePopoutAction : popout;
  const popoutButtonIcon = nativePopin ? Icons.ArrowLeft : Icons.External;

  return (
    <Box
      ref={controlRef}
      className={css.CallControlContainer}
      direction="Column"
      gap="200"
      justifyContent="Center"
      alignItems="Center"
    >
      {popoutBlocked && (
        <Text style={{ color: color.Critical.Main }} size="T200" align="Center">
          {t('call.popped_out.blocked')}
        </Text>
      )}
      <SequenceCard
        className={css.ControlCard}
        variant="SurfaceVariant"
        gap="400"
        radii="500"
        alignItems="Center"
        justifyContent="SpaceBetween"
      >
        <Box alignItems="Center" gap="Inherit" grow="Yes" direction={compact ? 'Column' : 'Row'}>
          <Box shrink="No" alignItems="Inherit" justifyContent="Inherit" gap="200">
            <MicrophoneButton enabled={microphone} onToggle={handleMicrophoneToggle} />
            <SoundButton enabled={sound} onToggle={() => callEmbed.control.toggleSound()} />
          </Box>
          {!compact && <ControlDivider />}
          <Box shrink="No" alignItems="Inherit" justifyContent="Inherit" gap="200">
            {cameraEnabled && <VideoButton enabled={video} onToggle={handleVideoToggle} />}
            <ScreenShareButton
              enabled={screenshare}
              onToggle={() => callEmbed.control.toggleScreenshare()}
            />
          </Box>
        </Box>
        {!compact && <ControlDivider />}
        <Box alignItems="Center" gap="Inherit" grow="Yes" direction={compact ? 'Column' : 'Row'}>
          <Box shrink="No" alignItems="Inherit" justifyContent="Inherit" gap="200">
            <ChatButton />
            <TooltipProvider
              position="Top"
              delay={500}
              tooltip={
                <Tooltip>
                  <Text size="T200">{popoutButtonLabel}</Text>
                </Tooltip>
              }
            >
              {(anchorRef) => (
                <IconButton
                  ref={anchorRef}
                  data-testid={popoutButtonTestId}
                  variant="Surface"
                  fill="Soft"
                  radii="400"
                  size="400"
                  onClick={popoutButtonOnClick}
                  outlined
                  disabled={popoutButtonPending}
                  aria-label={popoutButtonLabel}
                >
                  {popoutButtonPending ? (
                    <Spinner variant="Secondary" fill="Soft" size="200" />
                  ) : (
                    <Icon size="400" src={popoutButtonIcon} />
                  )}
                </IconButton>
              )}
            </TooltipProvider>
            <TooltipProvider
              position="Top"
              delay={500}
              tooltip={
                <Tooltip>
                  <Text size="T200">
                    {spotlight ? t('call.controls.grid_view') : t('call.controls.spotlight_view')}
                  </Text>
                </Tooltip>
              }
            >
              {(anchorRef) => (
                <IconButton
                  ref={anchorRef}
                  data-testid="call_layout_toggle"
                  variant={spotlight ? 'Primary' : 'Surface'}
                  fill="Soft"
                  radii="400"
                  size="400"
                  onClick={handleSpotlightClick}
                  outlined
                  aria-label={
                    spotlight ? t('call.controls.grid_view') : t('call.controls.spotlight_view')
                  }
                  aria-pressed={spotlight}
                >
                  <Icon size="400" src={Icons.Flag} filled={spotlight} />
                </IconButton>
              )}
            </TooltipProvider>
            {!spotlight && (
              <TooltipProvider
                position="Top"
                delay={500}
                tooltip={
                  <Tooltip>
                    <Text size="T200">
                      {emphasis ? t('call.controls.emphasis_off') : t('call.controls.emphasis_on')}
                    </Text>
                  </Tooltip>
                }
              >
                {(anchorRef) => (
                  <IconButton
                    ref={anchorRef}
                    data-testid="call_emphasis_toggle"
                    variant={emphasis ? 'Primary' : 'Surface'}
                    fill="Soft"
                    radii="400"
                    size="400"
                    onClick={handleEmphasisClick}
                    outlined
                    aria-label={
                      emphasis ? t('call.controls.emphasis_off') : t('call.controls.emphasis_on')
                    }
                    aria-pressed={emphasis}
                  >
                    <Icon size="400" src={Icons.Pin} filled={emphasis} />
                  </IconButton>
                )}
              </TooltipProvider>
            )}
            <PopOut
              anchor={cords}
              position="Top"
              align="Center"
              content={
                <FocusTrap
                  focusTrapOptions={{
                    initialFocus: false,
                    onDeactivate: () => setCords(undefined),
                    clickOutsideDeactivates: true,
                    isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
                    isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
                    escapeDeactivates: stopPropagation,
                  }}
                >
                  <Menu>
                    <Box direction="Column" style={{ padding: config.space.S100 }}>
                      <MenuItem
                        size="300"
                        variant="Surface"
                        radii="300"
                        onClick={handleSettingsClick}
                        data-testid="call_menu_settings"
                      >
                        <Text size="B300" truncate>
                          {t('call.controls.settings')}
                        </Text>
                      </MenuItem>
                    </Box>
                  </Menu>
                </FocusTrap>
              }
            >
              <IconButton
                variant="Surface"
                fill="Soft"
                radii="400"
                size="400"
                onClick={handleOpenMenu}
                outlined
                aria-pressed={!!cords}
                data-testid="call_menu"
              >
                <Icon size="400" src={Icons.VerticalDots} />
              </IconButton>
            </PopOut>
          </Box>
          <Box shrink="No" direction="Column">
            <Button
              style={{ minWidth: toRem(88) }}
              variant="Critical"
              fill="Solid"
              onClick={hangup}
              before={
                exiting ? (
                  <Spinner variant="Critical" fill="Solid" size="200" />
                ) : (
                  <Icon src={Icons.PhoneDown} size="200" filled />
                )
              }
              disabled={exiting}
              data-testid="call_hangup"
            >
              <Text size="B400">{t('call.controls.end')}</Text>
            </Button>
          </Box>
        </Box>
      </SequenceCard>
    </Box>
  );
}
