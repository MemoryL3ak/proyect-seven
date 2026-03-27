"use client";

import { createContext, useContext } from "react";

export type Theme = "dark";

const ThemeContext = createContext<{ theme: Theme }>({ theme: "dark" });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <ThemeContext.Provider value={{ theme: "dark" }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
