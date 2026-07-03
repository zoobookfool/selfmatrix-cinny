import { Room } from 'matrix-js-sdk';
import { useMemo } from 'react';
import i18n from '../i18n';
import { IPowerLevels } from './usePowerLevels';
import { useStateEvent } from './useStateEvent';
import { MemberPowerTag, StateEvent } from '../../types/matrix/room';

export type PowerLevelTags = Record<number, MemberPowerTag>;

const powerSortFn = (a: number, b: number) => b - a;
const sortPowers = (powers: number[]): number[] => powers.sort(powerSortFn);

export const getPowers = (tags: PowerLevelTags): number[] => {
  const powers: number[] = Object.keys(tags)
    .map((p) => {
      const power = parseInt(p, 10);
      if (Number.isNaN(power)) {
        return undefined;
      }
      return power;
    })
    .filter((power) => typeof power === 'number');

  return sortPowers(powers);
};

export const getUsedPowers = (powerLevels: IPowerLevels): Set<number> => {
  const powers: Set<number> = new Set();

  const findAndAddPower = (data: Record<string, unknown>) => {
    Object.keys(data).forEach((key) => {
      const powerOrAny: unknown = data[key];

      if (typeof powerOrAny === 'number') {
        powers.add(powerOrAny);
        return;
      }
      if (powerOrAny && typeof powerOrAny === 'object') {
        findAndAddPower(powerOrAny as Record<string, unknown>);
      }
    });
  };

  findAndAddPower(powerLevels);

  return powers;
};

const getDefaultTags = (): PowerLevelTags => ({
  9001: {
    name: i18n.t('room.power.goku'),
    color: '#ff6a00',
  },
  150: {
    name: i18n.t('room.power.manager'),
    color: '#ff6a7f',
  },
  101: {
    name: i18n.t('room.power.founder'),
    color: '#0000ff',
  },
  100: {
    name: i18n.t('room.power.admin'),
    color: '#0088ff',
  },
  50: {
    name: i18n.t('room.power.moderator'),
    color: '#1fd81f',
  },
  0: {
    name: i18n.t('room.power.member'),
    color: '#91cfdf',
  },
  [-1]: {
    name: i18n.t('room.power.muted'),
    color: '#888888',
  },
});

const generateFallbackTag = (powerLevelTags: PowerLevelTags, power: number): MemberPowerTag => {
  const highToLow = sortPowers(getPowers(powerLevelTags));

  const tagPower = highToLow.find((p) => p < power);
  const tag = typeof tagPower === 'number' ? powerLevelTags[tagPower] : undefined;

  return {
    name: tag
      ? i18n.t('room.power.fallback_tag', { tagName: tag.name, power })
      : i18n.t('room.power.fallback_team_tag', { power }),
  };
};

export const usePowerLevelTags = (room: Room, powerLevels: IPowerLevels): PowerLevelTags => {
  const tagsEvent = useStateEvent(room, StateEvent.PowerLevelTags);

  const powerLevelTags: PowerLevelTags = useMemo(() => {
    const content = tagsEvent?.getContent<PowerLevelTags>();
    const powerToTags: PowerLevelTags = { ...content };
    const defaultTags = getDefaultTags();

    const powers = getUsedPowers(powerLevels);
    Array.from(powers).forEach((power) => {
      if (powerToTags[power]?.name === undefined) {
        powerToTags[power] = defaultTags[power] ?? generateFallbackTag(defaultTags, power);
      }
    });

    return powerToTags;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [powerLevels, tagsEvent, i18n.language]);

  return powerLevelTags;
};

export const getPowerLevelTag = (
  powerLevelTags: PowerLevelTags,
  powerLevel: number
): MemberPowerTag => {
  const tag: MemberPowerTag | undefined = powerLevelTags[powerLevel];
  return tag ?? generateFallbackTag(powerLevelTags, powerLevel);
};
