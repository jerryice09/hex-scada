import React from "react";
import { COLORS } from "../data/constants";

// toast: { message: string, type: "success" | "error" } | null
// App.jsx가 setTimeout으로 일정 시간 뒤 toast를 null로 되돌려 자동으로 사라지게 한다.
export default function Toast({ toast }) {
  if (!toast) return null;
  const isError = toast.type === "error";
  const color = isError ? COLORS.danger : COLORS.normal;
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg text-sm font-mono shadow-lg"
      style={{ background: COLORS.panel, border: `1px solid ${color}66`, color, animation: "tabFadeIn 0.25s ease" }}
    >
      {toast.message}
    </div>
  );
}
