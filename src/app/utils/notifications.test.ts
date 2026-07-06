import { describe, expect, it } from 'vitest';
import { shouldNotifyForMessage } from './notifications';
import { NotificationType, UnreadInfo } from '../../types/matrix/room';

const unread = (highlight: number, total: number): UnreadInfo => ({
  roomId: '!room:example.org',
  highlight,
  total,
});

describe('shouldNotifyForMessage', () => {
  it('never notifies for muted rooms, even with a highlight increase', () => {
    const result = shouldNotifyForMessage({
      notificationType: NotificationType.Mute,
      isDirect: false,
      unreadInfo: unread(1, 1),
      cachedUnreadInfo: unread(0, 0),
    });
    expect(result).toBe(false);
  });

  // B1 regression: a room explicitly set to "All Messages" must notify for
  // plain messages, not just mentions/DMs.
  it('notifies for a plain message in a room explicitly set to All Messages', () => {
    const result = shouldNotifyForMessage({
      notificationType: NotificationType.AllMessages,
      isDirect: false,
      unreadInfo: unread(0, 1),
      cachedUnreadInfo: unread(0, 0),
    });
    expect(result).toBe(true);
  });

  it('does not notify for a plain message with no highlight increase in a Default room', () => {
    const result = shouldNotifyForMessage({
      notificationType: NotificationType.Default,
      isDirect: false,
      unreadInfo: unread(0, 3),
      cachedUnreadInfo: unread(0, 2),
    });
    expect(result).toBe(false);
  });

  it('notifies when highlight count increases (a new mention arrived)', () => {
    const result = shouldNotifyForMessage({
      notificationType: NotificationType.Default,
      isDirect: false,
      unreadInfo: unread(1, 1),
      cachedUnreadInfo: unread(0, 0),
    });
    expect(result).toBe(true);
  });

  it('notifies for a plain message in a direct message room', () => {
    const result = shouldNotifyForMessage({
      notificationType: NotificationType.Default,
      isDirect: true,
      unreadInfo: unread(0, 1),
      cachedUnreadInfo: unread(0, 0),
    });
    expect(result).toBe(true);
  });

  // B2 false-positive regression: without a cache prefill, a room that
  // already has unread highlights before mount must not treat the "missing
  // cache entry" as "previously zero highlights" and fire on the next plain
  // message. Callers are expected to prefill cachedUnreadInfo from
  // roomToUnreadAtom, so this asserts the prefilled (non-increasing) case
  // does not notify.
  it('does not notify for a plain message when the cache is prefilled with the current highlight count', () => {
    const result = shouldNotifyForMessage({
      notificationType: NotificationType.Default,
      isDirect: false,
      unreadInfo: unread(2, 5),
      cachedUnreadInfo: unread(2, 4),
    });
    expect(result).toBe(false);
  });

  it('does not notify when total is zero regardless of notification type', () => {
    const result = shouldNotifyForMessage({
      notificationType: NotificationType.AllMessages,
      isDirect: false,
      unreadInfo: unread(0, 0),
      cachedUnreadInfo: undefined,
    });
    expect(result).toBe(false);
  });
});
