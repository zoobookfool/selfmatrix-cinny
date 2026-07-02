// SelfMatrix: Discord 風の呼称に寄せた UI 文言。
// 将来の日本語化はこのモジュールの値の差し替えで行う。
export const BRANDING = {
  space: {
    addTooltip: 'Add Server',
    createTitle: 'Create Server',
    createSubTitle: 'Build a server for your community.',
    settingsLabel: 'Server Settings',
    leaveLabel: 'Leave Server',
    leavePrompt: 'Are you sure you want to leave this server?',
    newLabel: 'New Server',
    existingLabel: 'Existing Server',
    addLabel: 'Add Server',
    badgeLabel: 'Server',
  },
  room: {
    createTitle: 'Create Channel',
    createSubTitle: 'Build a channel for real-time conversations.',
    settingsLabel: 'Channel Settings',
    leaveLabel: 'Leave Channel',
    leavePrompt: 'Are you sure you want to leave this channel?',
    noRoomsTitle: 'No Channels',
    noRoomsMessage: 'You do not have any channels yet.',
    chatLabel: 'Text Channel',
    voiceLabel: 'Voice Channel',
    existingLabel: 'Existing Channel',
    addLabel: 'Add Channel',
  },
} as const;
