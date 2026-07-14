import React, { useCallback } from 'react';
import { Box, Button, Icon, Icons, Spinner, Text } from 'folds';
import { useTranslation } from 'react-i18next';
import { SequenceCard } from '../../components/sequence-card';
import * as css from './styles.css';
import { ChatButton, ControlDivider, MicrophoneButton, SoundButton, VideoButton } from './Controls';
import { useIsDirectRoom, useRoom } from '../../hooks/useRoom';
import { useCallEmbed, useCallJoined, useCallStart } from '../../hooks/useCallEmbed';
import { useCallPreferences } from '../../state/hooks/callPreferences';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';

type PrescreenControlsProps = {
  canJoin?: boolean;
};
export function PrescreenControls({ canJoin }: PrescreenControlsProps) {
  const { t } = useTranslation();
  const room = useRoom();
  const callEmbed = useCallEmbed();
  const callJoined = useCallJoined(callEmbed);
  const direct = useIsDirectRoom();
  const [cameraEnabled] = useSetting(settingsAtom, 'cameraEnabled');

  const inOtherCall = callEmbed && callEmbed.roomId !== room.roomId;

  const startCall = useCallStart(direct);
  const joining = callEmbed?.roomId === room.roomId && !callJoined;

  const disabled = inOtherCall || !canJoin;

  const { microphone, video, sound, toggleMicrophone, toggleVideo, toggleSound } =
    useCallPreferences();

  const handleMicrophoneToggle = useCallback(async () => toggleMicrophone(), [toggleMicrophone]);
  const handleVideoToggle = useCallback(async () => toggleVideo(), [toggleVideo]);
  const handleJoin = useCallback(() => {
    startCall(room, { microphone, video: cameraEnabled && video, sound });
    // A pre-call camera choice applies to this join only.
    if (video) toggleVideo();
  }, [startCall, room, microphone, cameraEnabled, video, sound, toggleVideo]);

  return (
    <SequenceCard
      className={css.ControlCard}
      variant="SurfaceVariant"
      gap="400"
      radii="500"
      alignItems="Center"
      justifyContent="SpaceBetween"
      wrap="Wrap"
    >
      <Box shrink="No" alignItems="Inherit" justifyContent="SpaceBetween" gap="200">
        <MicrophoneButton enabled={microphone} onToggle={handleMicrophoneToggle} />
        <SoundButton enabled={sound} onToggle={toggleSound} />
      </Box>
      <ControlDivider />
      <Box shrink="No" alignItems="Inherit" justifyContent="SpaceBetween" gap="200">
        {cameraEnabled && <VideoButton enabled={video} onToggle={handleVideoToggle} />}
        <ChatButton />
      </Box>
      <Box grow="Yes" direction="Column">
        <Button
          variant={disabled ? 'Secondary' : 'Success'}
          fill={disabled ? 'Soft' : 'Solid'}
          onClick={handleJoin}
          disabled={disabled || joining}
          before={
            joining ? (
              <Spinner variant="Success" fill="Solid" size="200" />
            ) : (
              <Icon src={Icons.Phone} size="200" filled />
            )
          }
        >
          <Text size="B400">{t('call.prescreen.join')}</Text>
        </Button>
      </Box>
    </SequenceCard>
  );
}
