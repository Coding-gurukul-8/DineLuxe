"use client"

import { useState, useEffect } from "react";

export default function ThemeToggle() {
  const [mode, setMode] = useState<'light'|'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Only run on client
    try {
      // Some test/dev environments can replace localStorage with a non-Storage value.
      const ls: any = (typeof window !== "undefined" ? (window as any).localStorage : undefined)
      const saved = ls && typeof ls.getItem === "function" ? ls.getItem("dineluxe-theme") : null
      const newMode = saved === "dark" ? "dark" : "light"
      setMode(newMode)

      const root = document.documentElement
      if (newMode === "dark") root.classList.add("dark-mode")
      else root.classList.remove("dark-mode")
    } catch {}
    setMounted(true);
  }, []);

  const handleToggle = () => {
    const newMode = mode === 'dark' ? 'light' : 'dark';
    setMode(newMode);
    
    const root = document.documentElement;
    if (newMode === 'dark') root.classList.add('dark-mode');
    else root.classList.remove('dark-mode');
    try {
      const ls: any = (typeof window !== "undefined" ? (window as any).localStorage : undefined)
      if (ls && typeof ls.setItem === "function") ls.setItem("dineluxe-theme", newMode)
    } catch {}
  };

  return (
    <button
      aria-label="Toggle theme"
      className="px-3 py-1 border rounded-md text-sm"
      onClick={handleToggle}
    >
      {mounted ? (mode === 'dark' ? '🌙 Dark' : '☀️ Light') : '☀️ Light'}
    </button>
  );
}
