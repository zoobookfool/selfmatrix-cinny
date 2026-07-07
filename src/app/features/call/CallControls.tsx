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
} from './Controls';
import { CallEmbed, useCallControlState } from '../../plugins/call';
import { useCallPopout } from '../../hooks/useCallEmbed';
import { useResizeObserver } from '../../hooks/useResizeObserver';
import { stopPropagation } from '../../utils/keyboard';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';
import { hasSelfmatrixNativeBridge } from '../../plugins/call/native/nativeBridge';

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

  // SelfMatrix: 配信特化のためカメラ UI は表示しない (機能は EC 側に温存)
  const { microphone, sound, screenshare, spotlight, emphasis } = useCallControlState(
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

  // SelfMatrix M1 step 3a レビュー FIX-A: ネイティブシェルでは popout ボタン自体を
  // 描画しない (窓移動は M3 で WebContentsView 再親子付けに置き換わる想定、
  // useCallEmbed.ts の useCallPopout ガード参照)。web では従来どおり描画する。
  const nativeShell = hasSelfmatrixNativeBridge();

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
            {/* SelfMatrix: 配信特化のためカメラ UI は表示しない (機能は EC 側に温存) */}
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
            {!nativeShell && (
              <TooltipProvider
                position="Top"
                delay={500}
                tooltip={
                  <Tooltip>
                    <Text size="T200">{t('call.controls.popout')}</Text>
                  </Tooltip>
                }
              >
                {(anchorRef) => (
                  <IconButton
                    ref={anchorRef}
                    data-testid="call_popout"
                    variant="Surface"
                    fill="Soft"
                    radii="400"
                    size="400"
                    onClick={popout}
                    outlined
                    disabled={popouting}
                    aria-label={t('call.controls.popout')}
                  >
                    {popouting ? (
                      <Spinner variant="Secondary" fill="Soft" size="200" />
                    ) : (
                      <Icon size="400" src={Icons.External} />
                    )}
                  </IconButton>
                )}
              </TooltipProvider>
            )}
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
            >
              <Text size="B400">{t('call.controls.end')}</Text>
            </Button>
          </Box>
        </Box>
      </SequenceCard>
    </Box>
  );
}
