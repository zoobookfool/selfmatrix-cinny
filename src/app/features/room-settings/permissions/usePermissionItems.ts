import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageEvent, StateEvent } from '../../../../types/matrix/room';
import { PermissionGroup } from '../../common-settings/permissions';

export const usePermissionGroups = (): PermissionGroup[] => {
  const { t, i18n } = useTranslation();

  const groups: PermissionGroup[] = useMemo(() => {
    const messagesGroup: PermissionGroup = {
      name: t('room_settings.permission_items.groups.messages'),
      items: [
        {
          location: {
            key: MessageEvent.RoomMessage,
          },
          name: t('room_settings.permission_items.send_messages'),
        },
        {
          location: {
            key: MessageEvent.Sticker,
          },
          name: t('room_settings.permission_items.send_stickers'),
        },
        {
          location: {
            key: MessageEvent.Reaction,
          },
          name: t('room_settings.permission_items.send_reactions'),
        },
        {
          location: {
            notification: true,
            key: 'room',
          },
          name: t('room_settings.permission_items.ping_room'),
        },
        {
          location: {
            state: true,
            key: StateEvent.RoomPinnedEvents,
          },
          name: t('room_settings.permission_items.pin_messages'),
        },
        {
          location: {},
          name: t('room_settings.permission_items.other_message_events'),
        },
      ],
    };

    const callSettingsGroup: PermissionGroup = {
      name: t('room_settings.permission_items.groups.calls'),
      items: [
        {
          location: {
            state: true,
            key: StateEvent.GroupCallMemberPrefix,
          },
          name: t('room_settings.permission_items.start_or_join_call'),
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
        {
          location: {
            action: true,
            key: 'redact',
          },
          name: t('room_settings.permission_items.delete_others_messages'),
        },
        {
          location: {
            key: MessageEvent.RoomRedaction,
          },
          name: t('room_settings.permission_items.delete_self_messages'),
        },
      ],
    };

    const roomOverviewGroup: PermissionGroup = {
      name: t('room_settings.permission_items.groups.room_overview'),
      items: [
        {
          location: {
            state: true,
            key: StateEvent.RoomAvatar,
          },
          name: t('room_settings.permission_items.room_avatar'),
        },
        {
          location: {
            state: true,
            key: StateEvent.RoomName,
          },
          name: t('room_settings.permission_items.room_name'),
        },
        {
          location: {
            state: true,
            key: StateEvent.RoomTopic,
          },
          name: t('room_settings.permission_items.room_topic'),
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
          name: t('room_settings.permission_items.change_room_access'),
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
            key: StateEvent.RoomEncryption,
          },
          name: t('room_settings.permission_items.enable_encryption'),
        },
        {
          location: {
            state: true,
            key: StateEvent.RoomHistoryVisibility,
          },
          name: t('room_settings.permission_items.history_visibility'),
        },
        {
          location: {
            state: true,
            key: StateEvent.RoomTombstone,
          },
          name: t('room_settings.permission_items.upgrade_room'),
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
        {
          location: {
            state: true,
            key: 'im.vector.modular.widgets',
          },
          name: t('room_settings.permission_items.modify_widgets'),
        },
      ],
    };

    return [
      messagesGroup,
      callSettingsGroup,
      moderationGroup,
      roomOverviewGroup,
      roomSettingsGroup,
      otherSettingsGroup,
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, i18n.language]);

  return groups;
};
