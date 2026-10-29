"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light";
type ThemeContextValue = { theme: Theme; setTheme: (theme: Theme) => void };
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => typeof window !== "undefined" && localStorage.getItem("frameflow-theme") === "light" ? "light" : "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("frameflow-theme", theme);
  }, [theme]);

  const setTheme = (next: Theme) => setThemeState(next);
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
