import { translate, TRANSLATIONS, LANGUAGES } from "../src/lib/i18n/translations.js";

describe("translate", () => {
  it("returns the string for a known key", () => {
    expect(translate("en", "save")).toBe("Save");
  });

  it("falls back to English when the locale lacks a key", () => {
    // Pass a key that exists in en; a sparse locale must not render the key.
    const result = translate("zh-CN", "save");
    expect(result).not.toBe("save");
    expect(result.length).toBeGreaterThan(0);
  });

  it("falls back to the key itself when nothing matches", () => {
    expect(translate("en", "definitely_not_a_real_key")).toBe("definitely_not_a_real_key");
  });

  it("falls back to English for an unknown locale", () => {
    expect(translate("xx-YY", "save")).toBe("Save");
  });

  // This is the bug that shipped: the context's t() dropped the vars
  // argument, so every templated string rendered a literal "{name}".
  describe("interpolation", () => {
    it("substitutes a named placeholder", () => {
      expect(translate("en", "them_message", { name: "Sam" })).toBe("Message Sam");
    });

    it("substitutes the same placeholder in a longer sentence", () => {
      const out = translate("en", "circle_boundaries_title", { name: "Sam" });
      expect(out).toBe("Sam's Boundaries");
      expect(out).not.toContain("{name}");
    });

    it("substitutes numeric values", () => {
      expect(translate("en", "story_count", { count: 3 })).toBe("3 notes");
    });

    it("interpolates in non-English locales too", () => {
      const out = translate("zh-CN", "them_know", { name: "小明" });
      expect(out).toContain("小明");
      expect(out).not.toContain("{name}");
    });

    it("leaves an unmatched token visible rather than rendering undefined", () => {
      const out = translate("en", "them_message", { wrongKey: "Sam" });
      expect(out).toContain("{name}");
      expect(out).not.toContain("undefined");
    });

    it("returns the template untouched when no vars are passed", () => {
      expect(translate("en", "them_message")).toBe("Message {name}");
    });
  });
});

describe("translation table integrity", () => {
  const locales = Object.keys(TRANSLATIONS);

  it("registers every locale in LANGUAGES", () => {
    for (const { code } of LANGUAGES) {
      expect(TRANSLATIONS[code]).toBeDefined();
    }
  });

  it("has no empty values", () => {
    for (const locale of locales) {
      for (const [key, value] of Object.entries(TRANSLATIONS[locale])) {
        expect(typeof value).toBe("string");
        if (value.trim().length === 0) {
          throw new Error(`${locale}.${key} is empty`);
        }
      }
    }
  });

  // A translation whose placeholders drifted from the English source renders
  // a literal "{name}" to that language's users only — easy to miss in review.
  it("keeps the same placeholders as the English source", () => {
    const placeholders = (s) => (s.match(/\{(\w+)\}/g) || []).sort().join(",");

    for (const locale of locales) {
      if (locale === "en") continue;
      for (const [key, value] of Object.entries(TRANSLATIONS[locale])) {
        const english = TRANSLATIONS.en[key];
        if (!english) continue;
        if (placeholders(value) !== placeholders(english)) {
          throw new Error(
            `${locale}.${key} placeholders "${placeholders(value)}" ` +
            `do not match en "${placeholders(english)}"`
          );
        }
      }
    }
  });
});
