import { createContext, useContext, useState, type ReactNode } from 'react';
import { getLanguage, setLanguage, type Lang } from './i18n';

type LanguageCtx = { lang: Lang; setLang: (l: Lang) => void };

const LanguageContext = createContext<LanguageCtx | null>(null);

// children을 render-prop으로 받아 현재 lang을 넘긴다 — 호출부에서 이 값을
// remount key로 써서 언어 변경 시 화면 전체가 새 strings를 다시 읽게 한다.
export function LanguageProvider({ children }: { children: (lang: Lang) => ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getLanguage());
  const setLang = (l: Lang) => {
    if (l === lang) return;
    setLanguage(l); // 모듈 strings 교체 + 파일 저장
    setLangState(l); // 리렌더 트리거
  };
  return (
    <LanguageContext.Provider value={{ lang, setLang }}>{children(lang)}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageCtx {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
