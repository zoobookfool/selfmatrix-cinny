import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EmojiGroupId } from '../../plugins/emoji';

export type IEmojiGroupLabels = Record<EmojiGroupId, string>;

export const useEmojiGroupLabels = (): IEmojiGroupLabels => {
  const { t, i18n } = useTranslation();

  return useMemo(
    () => ({
      [EmojiGroupId.People]: t('emoji_board.group_labels.smileys_people'),
      [EmojiGroupId.Nature]: t('emoji_board.group_labels.animals_nature'),
      [EmojiGroupId.Food]: t('emoji_board.group_labels.food_drinks'),
      [EmojiGroupId.Activity]: t('emoji_board.group_labels.activity'),
      [EmojiGroupId.Travel]: t('emoji_board.group_labels.travel_places'),
      [EmojiGroupId.Object]: t('emoji_board.group_labels.objects'),
      [EmojiGroupId.Symbol]: t('emoji_board.group_labels.symbols'),
      [EmojiGroupId.Flag]: t('emoji_board.group_labels.flags'),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language]
  );
};
