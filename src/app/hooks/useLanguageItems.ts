import { useMemo } from 'react';

export type LanguageItem = {
  value: string;
  name: string;
};

// SelfMatrix: 言語セレクタの選択肢。新しい言語パックを public/locales/<lng>.json に
// 追加したら、ここにも 1 エントリ追加する。
export const useLanguageItems = (): LanguageItem[] =>
  useMemo(
    () => [
      { value: 'system', name: 'Auto (System)' },
      { value: 'en', name: 'English' },
      { value: 'ja', name: '日本語' },
    ],
    []
  );
