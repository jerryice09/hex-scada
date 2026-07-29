import React from "react";
import { COLORS } from "../data/constants";

// score: 0~100, bucket: { label, color } (riskBucket()의 반환값)
export default function RiskGauge({ score, bucket }) {
  const R = 54;
  const circumference = 2 * Math.PI * R;
  const offset = circumference * (1 - score / 100);
  return (
    <svg width={150} height={150} viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={R} stroke={COLORS.panelBorder} strokeWidth="12" fill="none" />
      <circle
        cx="70"
        cy="70"
        r={R}
        stroke={bucket.color}
        strokeWidth="12"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 70 70)"
        style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.6s ease", animation: score >= 81 ? "scada-pulse-dot 0.8s ease-in-out infinite" : "none" }}
      />
      <text x="70" y="68" textAnchor="middle" fontSize="30" fontFamily="monospace" fontWeight="700" fill={COLORS.textPrimary}>
        {score}
      </text>
      <text x="70" y="90" textAnchor="middle" fontSize="13" fontFamily="monospace" fill={bucket.color}>
        {bucket.label}
      </text>
    </svg>
  );
}
