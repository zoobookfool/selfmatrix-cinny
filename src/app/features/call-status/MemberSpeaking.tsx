import { Room } from 'matrix-js-sdk';
import React from 'react';
import { Box, Icon, Icons, Text } from 'folds';
import { Trans } from 'react-i18next';
import { getMemberDisplayName } from '../../utils/room';
import { getMxIdLocalPart } from '../../utils/matrix';

type MemberSpeakingProps = {
  room: Room;
  speakers: Set<string>;
};
export function MemberSpeaking({ room, speakers }: MemberSpeakingProps) {
  const speakingNames = Array.from(speakers).map(
    (userId) => getMemberDisplayName(room, userId) ?? getMxIdLocalPart(userId) ?? userId
  );
  return (
    <Box alignItems="Center" gap="100">
      <Icon size="100" src={Icons.Mic} filled />
      <Text size="T200" truncate>
        {speakingNames.length === 1 && (
          <Trans
            i18nKey="call.status.speaking_one"
            values={{ name1: speakingNames[0] }}
            components={[<b />]}
          />
        )}
        {speakingNames.length === 2 && (
          <Trans
            i18nKey="call.status.speaking_two"
            values={{ name1: speakingNames[0], name2: speakingNames[1] }}
            components={[<b />, <b />]}
          />
        )}
        {speakingNames.length === 3 && (
          <Trans
            i18nKey="call.status.speaking_three"
            values={{ name1: speakingNames[0], name2: speakingNames[1], name3: speakingNames[2] }}
            components={[<b />, <b />, <b />]}
          />
        )}
        {speakingNames.length > 3 && (
          <Trans
            i18nKey="call.status.speaking_many"
            count={speakingNames.length - 3}
            values={{
              name1: speakingNames[0],
              name2: speakingNames[1],
              name3: speakingNames[2],
              count: speakingNames.length - 3,
            }}
            components={[<b />, <b />, <b />, <b />]}
          />
        )}
      </Text>
    </Box>
  );
}
