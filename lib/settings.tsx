import { createContext, useContext, useState, type ReactNode } from 'react';
import { getLanguage, setLanguage, type Lang } from './i18n';
import { getUnit, setUnit, type Unit } from './units';

type SettingsCtx = {
  lang: Lang;
  unit: Unit;
  setLang: (l: Lang) => void;
  setUnit: (u: Unit) => void;
};

const SettingsContext = createContext<SettingsCtx | null>(null);

// children을 render-prop으로 받아 현재 설정 조합을 넘긴다 — 호출부에서 이 값을
// remount key로 써서 언어/단위 변경 시 화면 전체가 새 strings·단위를 다시 읽게 한다.
export function SettingsProvider({ children }: { children: (key: string) => ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getLanguage());
  const [unit, setUnitState] = useState<Unit>(getUnit());
  const setLang = (l: Lang) => {
    if (l === lang) return;
    setLanguage(l);
    setLangState(l);
  };
  const setUnitPref = (u: Unit) => {
    if (u === unit) return;
    setUnit(u);
    setUnitState(u);
  };
  return (
    <SettingsContext.Provider value={{ lang, unit, setLang, setUnit: setUnitPref }}>
      {children(`${lang}-${unit}`)}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsCtx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
}
