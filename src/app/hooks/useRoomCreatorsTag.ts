import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MemberPowerTag } from '../../types/matrix/room';

export const useRoomCreatorsTag = (): MemberPowerTag => {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      name: t('room.power.founder'),
      color: '#0000ff',
    }),
    [t]
  );
};
