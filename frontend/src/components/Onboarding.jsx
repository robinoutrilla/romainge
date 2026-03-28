import React, { useState } from "react";
import { t } from "../i18n.js";

export default function Onboarding({ onComplete, th, lang }) {
  const [step, setStep] = useState(0);
  const steps = [
    { icon: "📞", title: t("onboardingStep1Title", lang), desc: t("onboardingStep1Desc", lang) },
    { icon: "🔑", title: t("onboardingStep2Title", lang), desc: t("onboardingStep2Desc", lang) },
    { icon: "💻", title: t("onboardingStep3Title", lang), desc: t("onboardingStep3Desc", lang) },
    { icon: "✅", title: t("onboardingStep4Title", lang), desc: t("onboardingStep4Desc", lang) },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: th.bg, borderRadius: 24, padding: "40px 36px", maxWidth: 440, width: "100%",
        border: `1px solid ${th.border}`, animation: "fadeIn 0.5s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>{steps[step].icon}</div>
          <h2 style={{ fontFamily: "'Playfair Display'", fontSize: 24, color: th.text, marginBottom: 12 }}>
            {steps[step].title}
          </h2>
          <p style={{ fontFamily: "'DM Sans'", fontSize: 14, color: th.textSecondary, lineHeight: 1.7 }}>
            {steps[step].desc}
          </p>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 24 }}>
          {steps.map((_, i) => (
            <div key={i} style={{ width: i === step ? 24 : 8, height: 8, borderRadius: 4,
              background: i === step ? th.accent : th.bgTertiary, transition: "all 0.3s" }} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <button onClick={onComplete} style={{ background: "none", border: "none", color: th.textTertiary,
            fontFamily: "'DM Sans'", fontSize: 13, cursor: "pointer" }}>
            {t("onboardingSkip", lang)}
          </button>
          {step < steps.length - 1 ? (
            <button onClick={() => setStep(step + 1)} style={{
              padding: "10px 24px", borderRadius: 12, border: "none",
              background: th.accentGradient, color: th.bg,
              fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}>{t("onboardingNext", lang)}</button>
          ) : (
            <button onClick={onComplete} style={{
              padding: "10px 24px", borderRadius: 12, border: "none",
              background: th.accentGradient, color: th.bg,
              fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}>{t("onboardingStart", lang)}</button>
          )}
        </div>
      </div>
    </div>
  );
}
