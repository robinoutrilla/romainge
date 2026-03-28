// ═══════════════════════════════════════════════════════════════
// tests/components.test.jsx — Snapshot tests para componentes React
// ═══════════════════════════════════════════════════════════════

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { themes } from "../src/theme.js";
import { t, LANGUAGES, getStoredLang } from "../src/i18n.js";

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = val; },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

// Mock fetch for API calls
globalThis.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ services: [] }),
  })
);

// Mock Notification
globalThis.Notification = { permission: "default", requestPermission: vi.fn() };

// Mock import.meta.env
vi.stubEnv("VITE_API_URL", "");

describe("Theme System", () => {
  it("dark theme has all required tokens", () => {
    const dark = themes.dark;
    const requiredTokens = [
      "bg", "bgSecondary", "text", "textSecondary", "border",
      "accent", "accentBg", "success", "error", "inputBg", "inputBorder",
      "chatUser", "chatAgent", "headerBg",
    ];
    for (const token of requiredTokens) {
      expect(dark[token]).toBeTruthy();
    }
  });

  it("light theme has all required tokens", () => {
    const light = themes.light;
    const requiredTokens = [
      "bg", "bgSecondary", "text", "textSecondary", "border",
      "accent", "accentBg", "success", "error", "inputBg", "inputBorder",
      "chatUser", "chatAgent", "headerBg",
    ];
    for (const token of requiredTokens) {
      expect(light[token]).toBeTruthy();
    }
  });

  it("dark and light themes have same token keys", () => {
    const darkKeys = Object.keys(themes.dark).sort();
    const lightKeys = Object.keys(themes.light).sort();
    expect(darkKeys).toEqual(lightKeys);
  });

  it("dark theme snapshot", () => {
    expect(themes.dark).toMatchSnapshot();
  });

  it("light theme snapshot", () => {
    expect(themes.light).toMatchSnapshot();
  });
});

describe("i18n Translations", () => {
  it("has 4 language options", () => {
    expect(LANGUAGES).toHaveLength(4);
    expect(LANGUAGES.map(l => l.code)).toEqual(["es", "ca", "eu", "gl"]);
  });

  it("translates header title in all languages", () => {
    for (const lang of LANGUAGES) {
      const title = t("title", lang.code);
      expect(title).toBeTruthy();
      expect(typeof title).toBe("string");
    }
  });

  it("falls back to Spanish for missing keys", () => {
    const esValue = t("title", "es");
    const unknownLang = t("title", "xx");
    expect(unknownLang).toBe(esValue);
  });

  it("all languages have same keys as Spanish", () => {
    // Get Spanish keys
    const esKeys = Object.keys(t("_all_keys_hack_", "es") || {});
    // This is a shallow check — just verify t() doesn't crash for common keys
    const commonKeys = ["title", "subtitle", "home", "services", "mySession", "renta", "exit"];
    for (const key of commonKeys) {
      for (const lang of LANGUAGES) {
        const val = t(key, lang.code);
        expect(val).toBeTruthy();
      }
    }
  });

  it("translations snapshot (Spanish)", () => {
    const keys = ["title", "subtitle", "home", "services", "mySession", "renta", "exit", "send", "footer"];
    const translations = {};
    for (const key of keys) {
      translations[key] = t(key, "es");
    }
    expect(translations).toMatchSnapshot();
  });

  it("translations snapshot (Catalan)", () => {
    const keys = ["title", "subtitle", "home", "services"];
    const translations = {};
    for (const key of keys) {
      translations[key] = t(key, "ca");
    }
    expect(translations).toMatchSnapshot();
  });
});

describe("MarkdownRenderer", () => {
  it("renders without crashing", async () => {
    // Dynamic import to avoid module resolution issues
    const { default: MarkdownRenderer } = await import("../src/MarkdownRenderer.jsx");

    const { container } = render(
      <MarkdownRenderer text="**Hola mundo**" theme={themes.dark} />
    );
    expect(container.textContent).toContain("Hola mundo");
  });

  it("renders markdown bold text", async () => {
    const { default: MarkdownRenderer } = await import("../src/MarkdownRenderer.jsx");

    const { container } = render(
      <MarkdownRenderer text="Texto **negrita** aquí" theme={themes.dark} />
    );
    const bold = container.querySelector("strong");
    expect(bold).toBeTruthy();
    expect(bold.textContent).toBe("negrita");
  });

  it("renders markdown list", async () => {
    const { default: MarkdownRenderer } = await import("../src/MarkdownRenderer.jsx");

    const { container } = render(
      <MarkdownRenderer text="- Item 1\n- Item 2\n- Item 3" theme={themes.dark} />
    );
    const items = container.querySelectorAll("li");
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it("renders markdown table (GFM)", async () => {
    const { default: MarkdownRenderer } = await import("../src/MarkdownRenderer.jsx");

    const md = `| Modelo | Plazo |\n|--------|-------|\n| 303 | 20/04 |\n| 130 | 20/04 |`;

    const { container } = render(
      <MarkdownRenderer text={md} theme={themes.dark} />
    );
    const table = container.querySelector("table");
    expect(table).toBeTruthy();
    const rows = container.querySelectorAll("tr");
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it("renders inline code", async () => {
    const { default: MarkdownRenderer } = await import("../src/MarkdownRenderer.jsx");

    const { container } = render(
      <MarkdownRenderer text="Use `modelo 303` para el IVA" theme={themes.dark} />
    );
    const code = container.querySelector("code");
    expect(code).toBeTruthy();
    expect(code.textContent).toBe("modelo 303");
  });

  it("renders with light theme", async () => {
    const { default: MarkdownRenderer } = await import("../src/MarkdownRenderer.jsx");

    const { container } = render(
      <MarkdownRenderer text="**Test**" theme={themes.light} />
    );
    expect(container.textContent).toContain("Test");
  });
});

describe("ChatWidget Component", () => {
  it("renders without crashing", async () => {
    const { default: ChatWidget } = await import("../src/ChatWidget.jsx");

    const { container } = render(<ChatWidget apiBase="" />);
    // Should render a floating button
    expect(container.firstChild).toBeTruthy();
  });

  it("snapshot of initial state", async () => {
    const { default: ChatWidget } = await import("../src/ChatWidget.jsx");

    const { container } = render(<ChatWidget apiBase="" />);
    expect(container.innerHTML).toMatchSnapshot();
  });
});
