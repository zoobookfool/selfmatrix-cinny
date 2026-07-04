// SelfMatrix: Discord 風の呼称に寄せた UI 文言。
// 値は public/locales/<lng>.json の "branding" 名前空間から i18next 経由で取得する。
import { useTranslation } from 'react-i18next';

// プロトコル側に送るアプリ識別子 (翻訳しない)。
export const APP_NAME = 'SelfMatrix';
export const WEB_DEVICE_NAME = `${APP_NAME} Web`;

export type Branding = {
  space: {
    addTooltip: string;
    createTitle: string;
    createSubTitle: string;
    settingsLabel: string;
    leaveLabel: string;
    leavePrompt: string;
    newLabel: string;
    existingLabel: string;
    addLabel: string;
    badgeLabel: string;
  };
  room: {
    createTitle: string;
    createSubTitle: string;
    settingsLabel: string;
    leaveLabel: string;
    leavePrompt: string;
    noRoomsTitle: string;
    noRoomsMessage: string;
    chatLabel: string;
    voiceLabel: string;
    existingLabel: string;
    addLabel: string;
  };
};

export const useBranding = (): Branding => {
  const { t } = useTranslation();

  return {
    space: {
      addTooltip: t('branding.space.add_tooltip'),
      createTitle: t('branding.space.create_title'),
      createSubTitle: t('branding.space.create_sub_title'),
      settingsLabel: t('branding.space.settings_label'),
      leaveLabel: t('branding.space.leave_label'),
      leavePrompt: t('branding.space.leave_prompt'),
      newLabel: t('branding.space.new_label'),
      existingLabel: t('branding.space.existing_label'),
      addLabel: t('branding.space.add_label'),
      badgeLabel: t('branding.space.badge_label'),
    },
    room: {
      createTitle: t('branding.room.create_title'),
      createSubTitle: t('branding.room.create_sub_title'),
      settingsLabel: t('branding.room.settings_label'),
      leaveLabel: t('branding.room.leave_label'),
      leavePrompt: t('branding.room.leave_prompt'),
      noRoomsTitle: t('branding.room.no_rooms_title'),
      noRoomsMessage: t('branding.room.no_rooms_message'),
      chatLabel: t('branding.room.chat_label'),
      voiceLabel: t('branding.room.voice_label'),
      existingLabel: t('branding.room.existing_label'),
      addLabel: t('branding.room.add_label'),
    },
  };
};
