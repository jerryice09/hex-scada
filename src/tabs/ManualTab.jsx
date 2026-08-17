import React from "react";
import { BookOpen } from "lucide-react";
import { COLORS } from "../data/constants";
import { MANUAL_SECTIONS } from "../data/manual";

// 문제점 개선: 신입 사원이 열교환기를 어떻게 가동/정지해야 하는지 안내할 문서가
// 전혀 없어서, 대시보드만 봐서는 "지금 뭘 해야 하는지" 판단하기 어려웠다.
// 이 탭은 가동 전 점검부터 정지 절차, SOP 요약, FAQ까지 한 곳에 정리해서 보여준다.
export default function ManualTab({ t }) {
  return (
    <section className="rounded-lg p-4 md:p-6" style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}` }}>
      <div className="flex items-center gap-2 mb-1">
        <BookOpen size={16} style={{ color: COLORS.cyan }} />
        <h2 className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>
          {t("manual_title")}
        </h2>
      </div>
      <p className="text-xs font-mono mb-5" style={{ color: COLORS.textDim }}>
        {t("manual_subtitle")}
      </p>

      <div className="flex flex-col gap-6">
        {MANUAL_SECTIONS.map((section) => (
          <div key={section.id}>
            <h3 className="text-sm font-bold mb-2 pb-1" style={{ color: COLORS.textPrimary, borderBottom: `1px solid ${COLORS.panelBorder}` }}>
              {section.title}
            </h3>
            <div className="flex flex-col gap-1">
              {section.body.map((line, i) =>
                line === "" ? (
                  <div key={i} className="h-2" />
                ) : (
                  <p key={i} className="text-sm leading-relaxed font-mono" style={{ color: COLORS.textDim, whiteSpace: "pre-wrap" }}>
                    {line}
                  </p>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
