import React, { ReactNode } from 'react';
import { IconSrc, Icons } from 'folds';
import { MatrixEvent } from 'matrix-js-sdk';
import { Trans, useTranslation } from 'react-i18next';
import { IMemberContent, Membership } from '../../types/matrix/room';
import { getMxIdLocalPart } from '../utils/matrix';
import { isMembershipChanged } from '../utils/room';

export type ParsedResult = {
  icon: IconSrc;
  body: ReactNode;
};

export type MemberEventParser = (mEvent: MatrixEvent) => ParsedResult;

export const useMemberEventParser = (): MemberEventParser => {
  const { t } = useTranslation();

  const parseMemberEvent: MemberEventParser = (mEvent) => {
    const content = mEvent.getContent<IMemberContent>();
    const prevContent = mEvent.getPrevContent() as IMemberContent;
    const senderId = mEvent.getSender();
    const userId = mEvent.getStateKey();
    const reason = typeof content.reason === 'string' ? content.reason : '';

    if (!senderId || !userId)
      return {
        icon: Icons.User,
        body: t('room.membership.broken_event'),
      };

    const senderName = getMxIdLocalPart(senderId);
    const userName =
      typeof content.displayname === 'string'
        ? content.displayname || getMxIdLocalPart(userId)
        : getMxIdLocalPart(userId);

    if (isMembershipChanged(mEvent)) {
      if (content.membership === Membership.Invite) {
        if (prevContent.membership === Membership.Knock) {
          return {
            icon: Icons.ArrowGoRightPlus,
            body: (
              <Trans
                i18nKey="room.membership.invite_accepted"
                values={{ senderName, userName, reason }}
              >
                <b>{senderName}</b>
                <b>{userName}</b>
              </Trans>
            ),
          };
        }

        return {
          icon: Icons.ArrowGoRightPlus,
          body: (
            <Trans i18nKey="room.membership.invited" values={{ senderName, userName, reason }}>
              <b>{senderName}</b>
              <b>{userName}</b>
            </Trans>
          ),
        };
      }

      if (content.membership === Membership.Knock) {
        return {
          icon: Icons.ArrowGoRightPlus,
          body: (
            <Trans i18nKey="room.membership.knocked" values={{ userName, reason }}>
              <b>{userName}</b>
            </Trans>
          ),
        };
      }

      if (content.membership === Membership.Join) {
        return {
          icon: Icons.ArrowGoRight,
          body: (
            <Trans i18nKey="room.membership.joined" values={{ userName }}>
              <b>{userName}</b>
            </Trans>
          ),
        };
      }

      if (content.membership === Membership.Leave) {
        if (prevContent.membership === Membership.Invite) {
          return {
            icon: Icons.ArrowGoRightCross,
            body:
              senderId === userId ? (
                <Trans
                  i18nKey="room.membership.invite_rejected_self"
                  values={{ userName, reason }}
                >
                  <b>{userName}</b>
                </Trans>
              ) : (
                <Trans
                  i18nKey="room.membership.invite_rejected_by_other"
                  values={{ senderName, userName, reason }}
                >
                  <b>{senderName}</b>
                  <b>{userName}</b>
                </Trans>
              ),
          };
        }

        if (prevContent.membership === Membership.Knock) {
          return {
            icon: Icons.ArrowGoRightCross,
            body:
              senderId === userId ? (
                <Trans i18nKey="room.membership.knock_revoked_self" values={{ userName, reason }}>
                  <b>{userName}</b>
                </Trans>
              ) : (
                <Trans
                  i18nKey="room.membership.knock_revoked_by_other"
                  values={{ senderName, userName, reason }}
                >
                  <b>{senderName}</b>
                  <b>{userName}</b>
                </Trans>
              ),
          };
        }

        if (prevContent.membership === Membership.Ban) {
          return {
            icon: Icons.ArrowGoLeft,
            body: (
              <Trans i18nKey="room.membership.unbanned" values={{ senderName, userName, reason }}>
                <b>{senderName}</b>
                <b>{userName}</b>
              </Trans>
            ),
          };
        }

        return {
          icon: Icons.ArrowGoLeft,
          body:
            senderId === userId ? (
              <Trans i18nKey="room.membership.left" values={{ userName, reason }}>
                <b>{userName}</b>
              </Trans>
            ) : (
              <Trans i18nKey="room.membership.kicked" values={{ senderName, userName, reason }}>
                <b>{senderName}</b>
                <b>{userName}</b>
              </Trans>
            ),
        };
      }

      if (content.membership === Membership.Ban) {
        return {
          icon: Icons.ArrowGoLeft,
          body: (
            <Trans i18nKey="room.membership.banned" values={{ senderName, userName, reason }}>
              <b>{senderName}</b>
              <b>{userName}</b>
            </Trans>
          ),
        };
      }
    }

    if (content.displayname !== prevContent.displayname) {
      const prevUserName =
        typeof prevContent.displayname === 'string'
          ? prevContent.displayname || getMxIdLocalPart(userId)
          : getMxIdLocalPart(userId);

      return {
        icon: Icons.Mention,
        body:
          typeof content.displayname === 'string' ? (
            <Trans
              i18nKey="room.membership.display_name_changed"
              values={{ prevUserName, userName }}
            >
              <b>{prevUserName}</b>
              <b>{userName}</b>
            </Trans>
          ) : (
            <Trans i18nKey="room.membership.display_name_removed" values={{ prevUserName }}>
              <b>{prevUserName}</b>
            </Trans>
          ),
      };
    }
    if (content.avatar_url !== prevContent.avatar_url) {
      return {
        icon: Icons.User,
        body:
          content.avatar_url && typeof content.avatar_url === 'string' ? (
            <Trans i18nKey="room.membership.avatar_changed" values={{ userName }}>
              <b>{userName}</b>
            </Trans>
          ) : (
            <Trans i18nKey="room.membership.avatar_removed" values={{ userName }}>
              <b>{userName}</b>
            </Trans>
          ),
      };
    }

    return {
      icon: Icons.User,
      body: t('room.membership.no_changes'),
    };
  };

  return parseMemberEvent;
};
