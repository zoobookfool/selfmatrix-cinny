import { MatrixClient, ReceiptType } from 'matrix-js-sdk';
import { NotificationType, UnreadInfo } from '../../types/matrix/room';

export type MessageNotifyGateParams = {
  notificationType: NotificationType;
  isDirect: boolean;
  unreadInfo: UnreadInfo;
  cachedUnreadInfo?: UnreadInfo;
};

/**
 * SelfMatrix: Discord-style noise control — pure decision for whether a plain
 * timeline message should trigger a toast/sound (vs. only updating the unread
 * badge). Kept side-effect free so it can be unit tested without mounting
 * MessageNotifications' matrix-js-sdk listeners.
 */
export function shouldNotifyForMessage({
  notificationType,
  isDirect,
  unreadInfo,
  cachedUnreadInfo,
}: MessageNotifyGateParams): boolean {
  // Mute is handled by the caller as an early-return before this is reached,
  // but guard here too so this function stays correct if called directly.
  if (notificationType === NotificationType.Mute) return false;

  if (unreadInfo.total === 0) return false;

  // Per-room "All Messages" preference: user explicitly opted this room out
  // of the mention/DM-only gate, so every notifying event should notify
  // (B1: previously only Mute was exempted from the mention/DM gate below,
  // silently swallowing plain messages in rooms set to "All Messages").
  if (notificationType === NotificationType.AllMessages) return true;

  // A room with no cache entry yet (e.g. app just started) must not be
  // treated as "no prior highlight" — that would fire a toast for every
  // pre-existing unread mention as soon as any new plain message arrives.
  // Callers are expected to prefill the cache from roomToUnreadAtom before
  // relying on this, so cachedUnreadInfo should only be missing for rooms
  // that truly had zero highlights before.
  const mentioned = unreadInfo.highlight > (cachedUnreadInfo?.highlight ?? 0);

  return mentioned || isDirect;
}

export async function markAsRead(mx: MatrixClient, roomId: string, privateReceipt: boolean) {
  const room = mx.getRoom(roomId);
  if (!room) return;

  const timeline = room.getLiveTimeline().getEvents();
  const readEventId = room.getEventReadUpTo(mx.getUserId()!);

  const getLatestValidEvent = () => {
    for (let i = timeline.length - 1; i >= 0; i -= 1) {
      const latestEvent = timeline[i];
      if (latestEvent.getId() === readEventId) return null;
      if (!latestEvent.isSending()) return latestEvent;
    }
    return null;
  };
  if (timeline.length === 0) return;
  const latestEvent = getLatestValidEvent();
  if (latestEvent === null) return;

  await mx.sendReadReceipt(
    latestEvent,
    privateReceipt ? ReceiptType.ReadPrivate : ReceiptType.Read
  );
}
