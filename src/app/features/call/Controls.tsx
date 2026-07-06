import React, { MouseEventHandler, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  config,
  Icon,
  IconButton,
  Icons,
  Line,
  Menu,
  PopOut,
  RectCords,
  Text,
  Tooltip,
  TooltipProvider,
} from 'folds';
import { useAtom } from 'jotai';
import FocusTrap from 'focus-trap-react';
import { useTranslation } from 'react-i18next';
import * as css from './styles.css';
import { callChatAtom } from '../../state/callEmbed';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';
import { stopPropagation } from '../../utils/keyboard';
import {
  getScreenShareFps,
  getScreenShareQuality,
  setScreenShareFps,
  setScreenShareQuality,
  ScreenShareFps,
  ScreenShareQuality,
} from './screenShareSettings';

export function ControlDivider() {
  return (
    <Line variant="SurfaceVariant" size="300" direction="Vertical" className={css.ControlDivider} />
  );
}

type MicrophoneButtonProps = {
  enabled: boolean;
  onToggle: () => Promise<unknown>;
};
export function MicrophoneButton({ enabled, onToggle }: MicrophoneButtonProps) {
  const { t } = useTranslation();
  const [micState, toggleMic] = useAsyncCallback(onToggle);
  const loading = micState.status === AsyncStatus.Loading;

  return (
    <TooltipProvider
      position="Top"
      delay={500}
      tooltip={
        <Tooltip>
          <Text size="T200">
            {enabled ? t('call.controls.microphone_off') : t('call.controls.microphone_on')}
          </Text>
        </Tooltip>
      }
    >
      {(anchorRef) => (
        <IconButton
          ref={anchorRef}
          variant={enabled ? 'Surface' : 'Warning'}
          fill="Soft"
          radii="400"
          size="400"
          onClick={toggleMic}
          outlined
          disabled={loading}
        >
          <Icon size="400" src={enabled ? Icons.Mic : Icons.MicMute} filled={!enabled} />
        </IconButton>
      )}
    </TooltipProvider>
  );
}

type SoundButtonProps = {
  enabled: boolean;
  onToggle: () => void;
};
export function SoundButton({ enabled, onToggle }: SoundButtonProps) {
  const { t } = useTranslation();
  return (
    <TooltipProvider
      position="Top"
      delay={500}
      tooltip={
        <Tooltip>
          <Text size="T200">
            {enabled ? t('call.controls.sound_off') : t('call.controls.sound_on')}
          </Text>
        </Tooltip>
      }
    >
      {(anchorRef) => (
        <IconButton
          ref={anchorRef}
          variant={enabled ? 'Surface' : 'Warning'}
          fill="Soft"
          radii="400"
          size="400"
          onClick={() => onToggle()}
          outlined
        >
          <Icon
            size="400"
            src={enabled ? Icons.Headphone : Icons.HeadphoneMute}
            filled={!enabled}
          />
        </IconButton>
      )}
    </TooltipProvider>
  );
}

type VideoButtonProps = {
  enabled: boolean;
  onToggle: () => Promise<unknown>;
};
export function VideoButton({ enabled, onToggle }: VideoButtonProps) {
  const { t } = useTranslation();
  const [videoState, toggleVideo] = useAsyncCallback(onToggle);
  const loading = videoState.status === AsyncStatus.Loading;

  return (
    <TooltipProvider
      position="Top"
      delay={500}
      tooltip={
        <Tooltip>
          <Text size="T200">
            {enabled ? t('call.controls.camera_off') : t('call.controls.camera_on')}
          </Text>
        </Tooltip>
      }
    >
      {(anchorRef) => (
        <IconButton
          ref={anchorRef}
          variant={enabled ? 'Success' : 'Surface'}
          fill="Soft"
          radii="400"
          size="400"
          onClick={toggleVideo}
          outlined
          disabled={loading}
        >
          <Icon
            size="400"
            src={enabled ? Icons.VideoCamera : Icons.VideoCameraMute}
            filled={enabled}
          />
        </IconButton>
      )}
    </TooltipProvider>
  );
}

const SCREEN_SHARE_QUALITIES: ScreenShareQuality[] = ['480', '720', '1080', '2160'];
const SCREEN_SHARE_QUALITY_LABEL: Record<ScreenShareQuality, string> = {
  '480': '480p',
  '720': '720p',
  '1080': '1080p',
  '2160': '4K',
};
const SCREEN_SHARE_FPS_OPTIONS: ScreenShareFps[] = [15, 30, 60];

type ScreenShareButtonProps = {
  enabled: boolean;
  onToggle: () => void;
};
export function ScreenShareButton({ enabled, onToggle }: ScreenShareButtonProps) {
  const { t } = useTranslation();
  const [cords, setCords] = useState<RectCords>();
  const [quality, setQuality] = useState<ScreenShareQuality>(() => getScreenShareQuality());
  const [fps, setFps] = useState<ScreenShareFps>(() => getScreenShareFps());

  const handleClick: MouseEventHandler<HTMLButtonElement> = (evt) => {
    if (enabled) {
      onToggle();
      return;
    }
    setQuality(getScreenShareQuality());
    setFps(getScreenShareFps());
    setCords(evt.currentTarget.getBoundingClientRect());
  };

  const handleStartShare = () => {
    setScreenShareQuality(quality);
    setScreenShareFps(fps);
    setCords(undefined);
    onToggle();
  };

  return (
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
            <Box
              direction="Column"
              gap="300"
              style={{ padding: config.space.S300, width: '15rem' }}
            >
              <Text size="L400">{t('call.controls.stream_settings')}</Text>
              <Box direction="Column" gap="100">
                <Text size="L400" priority="300">
                  {t('call.controls.quality')}
                </Text>
                <Box gap="100" wrap="Wrap">
                  {SCREEN_SHARE_QUALITIES.map((q) => (
                    <Chip
                      key={q}
                      data-testid={`ssq_${q}`}
                      variant={quality === q ? 'Primary' : 'SurfaceVariant'}
                      aria-pressed={quality === q}
                      outlined={quality === q}
                      radii="300"
                      onClick={() => setQuality(q)}
                      type="button"
                    >
                      <Text truncate size="T300">
                        {SCREEN_SHARE_QUALITY_LABEL[q]}
                      </Text>
                    </Chip>
                  ))}
                </Box>
              </Box>
              <Box direction="Column" gap="100">
                <Text size="L400" priority="300">
                  {t('call.controls.fps')}
                </Text>
                <Box gap="100" wrap="Wrap">
                  {SCREEN_SHARE_FPS_OPTIONS.map((f) => (
                    <Chip
                      key={f}
                      data-testid={`ssf_${f}`}
                      variant={fps === f ? 'Primary' : 'SurfaceVariant'}
                      aria-pressed={fps === f}
                      outlined={fps === f}
                      radii="300"
                      onClick={() => setFps(f)}
                      type="button"
                    >
                      <Text truncate size="T300">
                        {f}
                      </Text>
                    </Chip>
                  ))}
                </Box>
              </Box>
              <Button
                data-testid="ss_start"
                variant="Primary"
                fill="Solid"
                radii="300"
                size="400"
                onClick={handleStartShare}
              >
                <Text size="B400">{t('call.controls.start_share')}</Text>
              </Button>
            </Box>
          </Menu>
        </FocusTrap>
      }
    >
      <TooltipProvider
        position="Top"
        delay={500}
        tooltip={
          <Tooltip>
            <Text size="T200">
              {enabled ? t('call.controls.screenshare_off') : t('call.controls.screenshare_on')}
            </Text>
          </Tooltip>
        }
      >
        {(anchorRef) => (
          <IconButton
            ref={anchorRef}
            data-testid="call_control_screenshare"
            variant={enabled ? 'Success' : 'Surface'}
            fill="Soft"
            radii="400"
            size="400"
            onClick={handleClick}
            outlined
            aria-pressed={enabled || !!cords}
          >
            <Icon size="400" src={Icons.ScreenShare} filled={enabled} />
          </IconButton>
        )}
      </TooltipProvider>
    </PopOut>
  );
}

export function ChatButton() {
  const { t } = useTranslation();
  const [chat, setChat] = useAtom(callChatAtom);

  return (
    <TooltipProvider
      position="Top"
      delay={500}
      tooltip={
        <Tooltip>
          <Text size="T200">
            {chat ? t('call.controls.chat_close') : t('call.controls.chat_open')}
          </Text>
        </Tooltip>
      }
    >
      {(anchorRef) => (
        <IconButton
          ref={anchorRef}
          variant={chat ? 'Success' : 'Surface'}
          fill="Soft"
          radii="400"
          size="400"
          onClick={() => setChat(!chat)}
          outlined
        >
          <Icon size="400" src={Icons.Message} filled={chat} />
        </IconButton>
      )}
    </TooltipProvider>
  );
}
