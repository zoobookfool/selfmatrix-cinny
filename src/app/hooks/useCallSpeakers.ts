import { useCallback, useEffect, useMemo, useState } from 'react';
import { CallEmbed } from '../plugins/call';
import { useMutationObserver } from './useMutationObserver';
import { isUserId } from '../utils/matrix';
import { useCallMembers, useCallSession } from './useCall';
import { useCallJoined } from './useCallEmbed';

export const useCallSpeakers = (callEmbed: CallEmbed): Set<string> => {
  const [speakers, setSpeakers] = useState(new Set<string>());
  const callSession = useCallSession(callEmbed.room);
  const callMembers = useCallMembers(callSession);
  const joined = useCallJoined(callEmbed);

  const videoContainers = useMemo(() => {
    if (callMembers && joined) return callEmbed.document?.querySelectorAll('[data-video-fit]');
    return undefined;
  }, [callEmbed, callMembers, joined]);

  const mutationObserver = useMutationObserver(
    useCallback(
      (mutations) => {
        const s = new Set<string>();

        mutations.forEach((mutation) => {
          if (mutation.type !== 'attributes') return;
          const el = mutation.target as HTMLElement;

          // SelfMatrix M1 step 3a レビュー FIX-B: NativeCallEmbed (iframe 無し) が
          // 将来 CallEmbed として渡された場合に TypeError にならないよう iframe 自体も
          // optional chain する (web では iframe は常在のため挙動不変)。
          const style = callEmbed.iframe?.contentWindow?.getComputedStyle(el, '::before');
          if (!style) return;
          const tileBackgroundImage = style.getPropertyValue('background-image');
          const speaking = tileBackgroundImage !== 'none';
          if (!speaking) return;

          const speakerId = el.querySelector('[aria-label]')?.getAttribute('aria-label');
          if (speakerId && isUserId(speakerId)) {
            s.add(speakerId);
          }
        });

        setSpeakers(s);
      },
      [callEmbed]
    )
  );

  useEffect(() => {
    videoContainers?.forEach((element) => {
      mutationObserver.observe(element, {
        attributes: true,
        attributeFilter: ['class', 'style'],
      });
    });

    return () => {
      mutationObserver.disconnect();
    };
  }, [videoContainers, mutationObserver]);

  return speakers;
};
