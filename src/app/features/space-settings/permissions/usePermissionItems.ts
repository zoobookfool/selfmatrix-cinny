import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StateEvent } from '../../../../types/matrix/room';
import { PermissionGroup } from '../../common-settings/permissions';

export const usePermissionGroups = (): PermissionGroup[] => {
  const { t, i18n } = useTranslation();

  const groups: PermissionGroup[] = useMemo(() => {
    const messagesGroup: PermissionGroup = {
      name: t('room_settings.permission_items.groups.manage'),
      items: [
        {
          location: {
            state: true,
            key: StateEvent.SpaceChild,
          },
          name: t('room_settings.permission_items.manage_space_rooms'),
        },
        {
          location: {},
          name: t('room_settings.permission_items.message_events'),
        },
      ],
    };

    const moderationGroup: PermissionGroup = {
      name: t('room_settings.permission_items.groups.moderation'),
      items: [
        {
          location: {
            action: true,
            key: 'invite',
          },
          name: t('room_settings.permission_items.invite'),
        },
        {
          location: {
            action: true,
            key: 'kick',
          },
          name: t('room_settings.permission_items.kick'),
        },
        {
          location: {
            action: true,
            key: 'ban',
          },
          name: t('room_settings.permission_items.ban'),
        },
      ],
    };

    const roomOverviewGroup: PermissionGroup = {
      name: t('room_settings.permission_items.groups.space_overview'),
      items: [
        {
          location: {
            state: true,
            key: StateEvent.RoomAvatar,
          },
          name: t('room_settings.permission_items.space_avatar'),
        },
        {
          location: {
            state: true,
            key: StateEvent.RoomName,
          },
          name: t('room_settings.permission_items.space_name'),
        },
        {
          location: {
            state: true,
            key: StateEvent.RoomTopic,
          },
          name: t('room_settings.permission_items.space_topic'),
        },
      ],
    };

    const roomSettingsGroup: PermissionGroup = {
      name: t('room_settings.permission_items.groups.settings'),
      items: [
        {
          location: {
            state: true,
            key: StateEvent.RoomJoinRules,
          },
          name: t('room_settings.permission_items.change_space_access'),
        },
        {
          location: {
            state: true,
            key: StateEvent.RoomCanonicalAlias,
          },
          name: t('room_settings.permission_items.publish_address'),
        },
        {
          location: {
            state: true,
            key: StateEvent.RoomPowerLevels,
          },
          name: t('room_settings.permission_items.change_all_permission'),
        },
        {
          location: {
            state: true,
            key: StateEvent.PowerLevelTags,
          },
          name: t('room_settings.permission_items.edit_power_levels'),
        },
        {
          location: {
            state: true,
            key: StateEvent.RoomTombstone,
          },
          name: t('room_settings.permission_items.upgrade_space'),
        },
        {
          location: {
            state: true,
          },
          name: t('room_settings.permission_items.other_settings'),
        },
      ],
    };

    const otherSettingsGroup: PermissionGroup = {
      name: t('room_settings.permission_items.groups.other'),
      items: [
        {
          location: {
            state: true,
            key: StateEvent.PoniesRoomEmotes,
          },
          name: t('room_settings.permission_items.manage_emojis_stickers'),
        },
        {
          location: {
            state: true,
            key: StateEvent.RoomServerAcl,
          },
          name: t('room_settings.permission_items.change_server_acls'),
        },
      ],
    };

    return [
      messagesGroup,
      moderationGroup,
      roomOverviewGroup,
      roomSettingsGroup,
      otherSettingsGroup,
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, i18n.language]);

  return groups;
};
