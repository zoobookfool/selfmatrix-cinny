import React, { RefObject, useCallback, useRef } from 'react';
import {
  Box,
  Badge,
  Button,
  color,
  Header,
  Icon,
  Icons,
  Scroll,
  Spinner,
  Text,
  toRem,
} from 'folds';
import { useTranslation } from 'react-i18next';
import {
  useCallEmbed,
  useCallJoined,
  useCallEmbedPlacementSync,
  useCallPopin,
} from '../../hooks/useCallEmbed';
import { ContainerColor } from '../../styles/ContainerColor.css';
import { PrescreenControls } from './PrescreenControls';
import { usePowerLevelsContext } from '../../hooks/usePowerLevels';
import { useRoom } from '../../hooks/useRoom';
import { useRoomCreators } from '../../hooks/useRoomCreators';
import { useRoomPermissions } from '../../hooks/useRoomPermissions';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { StateEvent } from '../../../types/matrix/room';
import { useCallMembers, useCallSession } from '../../hooks/useCall';
import { CallMemberRenderer } from './CallMemberCard';
import * as css from './styles.css';
import { CallControls } from './CallControls';
import { useLivekitSupport } from '../../hooks/useLivekitSupport';
import { webRTCSupported } from '../../utils/rtc';
import { CallPopout } from '../../plugins/call';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';

function LivekitServerMissingMessage() {
  const { t } = useTranslation();
  return (
    <Text style={{ margin: 'auto', color: color.Critical.Main }} size="L400" align="Center">
      {t('call.prescreen.no_livekit_support')}
    </Text>
  );
}

function WebRTCMissingError() {
  const { t } = useTranslation();
  return (
    <Text style={{ margin: 'auto', color: color.Critical.Main }} size="L400" align="Center">
      {t('call.prescreen.no_webrtc_support')}
    </Text>
  );
}

function JoinMessage({
  hasParticipant,
  livekitSupported,
  rtcSupported,
}: {
  hasParticipant?: boolean;
  livekitSupported?: boolean;
  rtcSupported?: boolean;
}) {
  const { t } = useTranslation();

  if (rtcSupported === false) {
    return <WebRTCMissingError />;
  }

  if (livekitSupported === false) {
    return <LivekitServerMissingMessage />;
  }

  if (hasParticipant) return null;

  return (
    <Text style={{ margin: 'auto' }} size="L400" align="Center">
      {t('call.prescreen.empty_voice_chat')}
    </Text>
  );
}

function NoPermissionMessage() {
  const { t } = useTranslation();
  return (
    <Text style={{ margin: 'auto' }} size="L400" align="Center">
      {t('call.prescreen.no_permission')}
    </Text>
  );
}

function AlreadyInCallMessage() {
  const { t } = useTranslation();
  return (
    <Text style={{ margin: 'auto', color: color.Warning.Main }} size="L400" align="Center">
      {t('call.prescreen.already_in_call')}
    </Text>
  );
}

function CallPrescreen() {
  const { t } = useTranslation();
  const mx = useMatrixClient();
  const room = useRoom();
  const livekitSupported = useLivekitSupport();
  const rtcSupported = webRTCSupported();

  const powerLevels = usePowerLevelsContext();
  const creators = useRoomCreators(room);

  const permissions = useRoomPermissions(creators, powerLevels);
  const hasPermission = permissions.stateEvent(
    StateEvent.GroupCallMemberPrefix,
    mx.getSafeUserId()
  );

  const callSession = useCallSession(room);
  const callMembers = useCallMembers(callSession);
  const hasParticipant = callMembers.length > 0;

  const callEmbed = useCallEmbed();
  const inOtherCall = callEmbed && callEmbed.roomId !== room.roomId;

  const canJoin = hasPermission && livekitSupported && rtcSupported;

  return (
    <Scroll variant="Surface" hideTrack>
      <Box className={css.CallViewContent} alignItems="Center" justifyContent="Center">
        <Box style={{ maxWidth: toRem(382), width: '100%' }} direction="Column" gap="100">
          {hasParticipant && (
            <Header size="300">
              <Box grow="Yes" alignItems="Center">
                <Text size="L400">{t('call.prescreen.participant')}</Text>
              </Box>
              <Badge variant="Critical" fill="Solid" size="400">
                <Text as="span" size="L400" truncate>
                  {t('shell.nav.live_count', { count: callMembers.length })}
                </Text>
              </Badge>
            </Header>
          )}
          <CallMemberRenderer members={callMembers} />
          <PrescreenControls canJoin={canJoin} />
          <Box className={css.PrescreenMessage} alignItems="Center">
            {!inOtherCall &&
              (hasPermission ? (
                <JoinMessage
                  hasParticipant={hasParticipant}
                  livekitSupported={livekitSupported}
                  rtcSupported={rtcSupported}
                />
              ) : (
                <NoPermissionMessage />
              ))}
            {inOtherCall && <AlreadyInCallMessage />}
          </Box>
        </Box>
      </Box>
    </Scroll>
  );
}

type PoppedOutBannerProps = {
  callEmbed: CallPopout;
};
function PoppedOutBanner({ callEmbed }: PoppedOutBannerProps) {
  const { t } = useTranslation();

  const popinCall = useCallPopin();
  const [popinState, popin] = useAsyncCallback(
    useCallback(() => popinCall(callEmbed), [popinCall, callEmbed])
  );
  const popining = popinState.status === AsyncStatus.Loading;
  const popinFailed = popinState.status === AsyncStatus.Error;

  const [hangupState, hangup] = useAsyncCallback(
    useCallback(() => callEmbed.hangup(), [callEmbed])
  );
  const exiting =
    hangupState.status === AsyncStatus.Loading || hangupState.status === AsyncStatus.Success;

  return (
    <Box className={css.CallViewContent} direction="Column" gap="300" alignItems="Center">
      <Box direction="Column" gap="100" alignItems="Center" style={{ maxWidth: toRem(382) }}>
        <Text size="H5" align="Center">
          {t('call.popped_out.title')}
        </Text>
        {popinFailed && (
          <Text style={{ color: color.Critical.Main }} size="T200" align="Center">
            {t('call.popped_out.return_failed')}
          </Text>
        )}
      </Box>
      <Box gap="300">
        <Button
          variant="Primary"
          fill="Solid"
          radii="400"
          size="400"
          data-testid="call_popin"
          onClick={popin}
          disabled={popining || exiting}
          before={
            popining ? (
              <Spinner variant="Primary" fill="Solid" size="200" />
            ) : (
              <Icon size="200" src={Icons.ArrowLeft} />
            )
          }
        >
          <Text size="B400">{t('call.popped_out.return')}</Text>
        </Button>
        <Button
          variant="Critical"
          fill="Soft"
          radii="400"
          size="400"
          onClick={hangup}
          disabled={exiting || popining}
          before={
            exiting ? (
              <Spinner variant="Critical" fill="Soft" size="200" />
            ) : (
              <Icon src={Icons.PhoneDown} size="200" filled />
            )
          }
        >
          <Text size="B400">{t('call.controls.end')}</Text>
        </Button>
      </Box>
    </Box>
  );
}

type CallJoinedProps = {
  containerRef: RefObject<HTMLDivElement>;
  joined: boolean;
};
function CallJoined({ joined, containerRef }: CallJoinedProps) {
  const callEmbed = useCallEmbed();
  const poppedOut = callEmbed instanceof CallPopout && joined;

  // SelfMatrix fix (敵対的レビュー FIX-2): ポップアウト中でも container の
  // <Box ref={containerRef}> は常時同じ場所に1つだけマウントしたままにする
  // (以前はポップアウト時にこの Box ごとアンマウントしていたため、pop-in 後に
  // 生成される新しい DOM ノードに useCallEmbedPlacementSync の
  // ResizeObserver が付き直らず、リサイズ追従が止まっていた)。ノードを不変に
  // することで observer は生き続け、「popout→popin→ウィンドウリサイズで
  // embed が追従する」が保証される。ポップアウト中は callVisible=false
  // (CallEmbedProvider 側) で embed 自体は非表示になるので、container 側は
  // 高さ 0 にして視覚的に隠し、代わりに PoppedOutBanner を表示する。
  return (
    <Box grow="Yes" direction="Column">
      {poppedOut && <PoppedOutBanner callEmbed={callEmbed} />}
      <Box
        grow={poppedOut ? 'No' : 'Yes'}
        direction="Column"
        style={poppedOut ? { height: 0, minHeight: 0, overflow: 'hidden' } : undefined}
      >
        <Box grow="Yes" ref={containerRef} />
      </Box>
      {!poppedOut && callEmbed && joined && <CallControls callEmbed={callEmbed} />}
    </Box>
  );
}

export function CallView() {
  const room = useRoom();
  const callContainerRef = useRef<HTMLDivElement>(null);
  useCallEmbedPlacementSync(callContainerRef);

  const callEmbed = useCallEmbed();
  const callJoined = useCallJoined(callEmbed);

  const currentJoined = callEmbed?.roomId === room.roomId && callJoined;

  return (
    <Box
      className={ContainerColor({ variant: 'Surface' })}
      style={{ minWidth: toRem(280) }}
      grow="Yes"
    >
      {!currentJoined && <CallPrescreen />}
      <CallJoined joined={currentJoined} containerRef={callContainerRef} />
    </Box>
  );
}
