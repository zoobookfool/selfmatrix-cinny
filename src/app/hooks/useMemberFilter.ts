import { useMemo } from 'react';
import { RoomMember } from 'matrix-js-sdk';
import { useTranslation } from 'react-i18next';
import { Membership } from '../../types/matrix/room';

export const MembershipFilter = {
  filterJoined: (m: RoomMember) => m.membership === Membership.Join,
  filterInvited: (m: RoomMember) => m.membership === Membership.Invite,
  filterLeaved: (m: RoomMember) =>
    m.membership === Membership.Leave &&
    m.events.member?.getStateKey() === m.events.member?.getSender(),
  filterKicked: (m: RoomMember) =>
    m.membership === Membership.Leave &&
    m.events.member?.getStateKey() !== m.events.member?.getSender(),
  filterBanned: (m: RoomMember) => m.membership === Membership.Ban,
};

export type MembershipFilterFn = (m: RoomMember) => boolean;

export type MembershipFilterItem = {
  name: string;
  filterFn: MembershipFilterFn;
};

export const useMembershipFilterMenu = (): MembershipFilterItem[] => {
  const { t, i18n } = useTranslation();

  return useMemo(
    () => [
      {
        name: t('room.member_filter.joined'),
        filterFn: MembershipFilter.filterJoined,
      },
      {
        name: t('room.member_filter.invited'),
        filterFn: MembershipFilter.filterInvited,
      },
      {
        name: t('room.member_filter.left'),
        filterFn: MembershipFilter.filterLeaved,
      },
      {
        name: t('room.member_filter.kicked'),
        filterFn: MembershipFilter.filterKicked,
      },
      {
        name: t('room.member_filter.banned'),
        filterFn: MembershipFilter.filterBanned,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language]
  );
};

export const useMembershipFilter = (
  index: number,
  membershipFilter: MembershipFilterItem[]
): MembershipFilterItem => {
  const filter = membershipFilter[index] ?? membershipFilter[0];
  return filter;
};
