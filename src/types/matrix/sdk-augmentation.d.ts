import { PackContent, EmoteRoomsContent } from '../../app/plugins/custom-emoji/types';
import { InCinnySpacesContent } from '../../app/hooks/useSidebarItems';
import { IRecentEmojiContent } from '../../app/plugins/recent-emoji';
import { ShellLayoutContent } from '../../app/state/shellLayout';
import { FirstRunSetupContent } from './accountData';

declare module 'matrix-js-sdk' {
  interface StateEvents {
    'im.ponies.room_emotes': PackContent;
  }

  interface AccountDataEvents {
    'im.ponies.user_emotes': PackContent;
    'im.ponies.emote_rooms': EmoteRoomsContent;
    'in.cinny.spaces': InCinnySpacesContent;
    'io.element.recent_emoji': IRecentEmojiContent;
    'in.selfmatrix.shell_layout': ShellLayoutContent;
    'in.selfmatrix.first_run_setup': FirstRunSetupContent;
  }
}
