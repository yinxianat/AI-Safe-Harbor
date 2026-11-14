/**
 * Which language a message is written in, decided from the text itself.
 *
 * The rephraser is not a translator. It had been told which language to write
 * in by the *receiver's* UI locale, so a message typed in Chinese to someone
 * whose app was set to English came out in English, and an English message to
 * someone reading in Chinese came out in Chinese. Either way the sender's
 * words were replaced with a translation they never wrote and could not
 * check — the worst case for a tool whose output is attributed to them.
 *
 * Detection is by Unicode script, which is deterministic and needs no model
 * call. Script identifies a language only where the script is distinctive:
 * Han characters mean Chinese or Japanese, Hangul means Korean. It cannot
 * separate English from Spanish, so for Latin text this reports "latin"
 * without guessing, and the prompt falls back to "write in the same language
 * as the message" — an instruction the model can follow from the text when we
 * cannot narrow it ourselves.
 */

/**
 * Ranges chosen to be unambiguous. Each entry's `test` matches characters
 * only that script uses, so one Kana character is enough to call a Han-plus-
 * Kana message Japanese rather than Chinese.
 */
const SCRIPTS = [
  // Checked before Han: Japanese text is mostly Han, but any Kana settles it.
  { code: "ja", name: "Japanese", test: /[぀-ゟ゠-ヿ]/ },
  { code: "ko", name: "Korean", test: /[가-힯ᄀ-ᇿ㄰-㆏]/ },
  { code: "zh", name: "Chinese", test: /[一-鿿㐀-䶿豈-﫿]/ },
  { code: "ar", name: "Arabic", test: /[؀-ۿݐ-ݿࢠ-ࣿ]/ },
  { code: "he", name: "Hebrew", test: /[֐-׿]/ },
  { code: "ru", name: "Cyrillic", test: /[Ѐ-ӿԀ-ԯ]/ },
  { code: "el", name: "Greek", test: /[Ͱ-Ͽἀ-῿]/ },
  { code: "hi", name: "Devanagari", test: /[ऀ-ॿ]/ },
  { code: "bn", name: "Bengali", test: /[ঀ-৿]/ },
  { code: "ta", name: "Tamil", test: /[஀-௿]/ },
  { code: "th", name: "Thai", test: /[฀-๿]/ },
  { code: "hy", name: "Armenian", test: /[԰-֏]/ },
  { code: "ka", name: "Georgian", test: /[Ⴀ-ჿ]/ },
];

const LATIN = /[A-Za-zÀ-ɏ]/;

/**
 * Traditional vs Simplified, for the two Chinese variants the app ships.
 *
 * Only characters that differ between the two are listed, and the call is a
 * simple majority. A short message may contain none of them, in which case
 * the variant stays unknown and the prompt just says "Chinese" — better than
 * asserting Simplified and having a Taiwanese user's message rewritten in
 * characters they do not use.
 */
const TRADITIONAL_ONLY = /[這裡來說對時個們麼後體學國會愛兒點萬與東車馬鳥魚龍龜灣臺灣開關門問間]/g;
const SIMPLIFIED_ONLY = /[这里来说对时个们么后体学国会爱儿点万与东车马鸟鱼龙龟湾台湾开关门问间]/g;

function chineseVariant(text) {
  const traditional = (text.match(TRADITIONAL_ONLY) || []).length;
  const simplified = (text.match(SIMPLIFIED_ONLY) || []).length;
  if (traditional === 0 && simplified === 0) return null;
  return traditional > simplified ? "zh-TW" : "zh-CN";
}

/**
 * @param text the message as written
 * @returns {{ code, name, confident }}
 *   `confident` is true only when the script itself identifies the language.
 *   Latin text and empty input report `confident: false`, and callers must
 *   then let the model follow the text rather than being told a language.
 */
export function detectLanguage(text) {
  if (typeof text !== "string" || !text.trim()) {
    return { code: null, name: null, confident: false };
  }

  for (const script of SCRIPTS) {
    if (!script.test.test(text)) continue;

    if (script.code === "zh") {
      const variant = chineseVariant(text);
      return {
        code: variant || "zh",
        name: variant === "zh-TW" ? "Traditional Chinese (繁體中文)" : variant === "zh-CN" ? "Simplified Chinese (简体中文)" : "Chinese",
        confident: true,
      };
    }

    return { code: script.code, name: script.name, confident: true };
  }

  if (LATIN.test(text)) {
    // Latin script is shared by dozens of languages, so this is deliberately
    // not a guess at which one.
    return { code: "latin", name: null, confident: false };
  }

  return { code: null, name: null, confident: false };
}

/**
 * The language rule for a prompt.
 *
 * Phrased as "match the message" first and the detected name second, so the
 * model has the correct behaviour even when detection abstains. The receiver's
 * UI locale is deliberately NOT part of this: which language someone reads the
 * app's buttons in says nothing about which language their partner wrote to
 * them in, and using it to pick the output language is what caused the
 * translation bug.
 */
export function languageInstruction(text) {
  const detected = detectLanguage(text);

  const base =
    "Write your reply in the SAME language as the sender's message. You are rephrasing, never translating: if the message is in Chinese the reply is in Chinese, if it is in English the reply is in English, and the same for every other language. Keep the sender's own script and regional variant.";

  if (detected.confident && detected.name) {
    return `${base} The sender's message is written in ${detected.name}, so reply in ${detected.name}.`;
  }

  // A mixed-language message keeps whichever language dominates it, which the
  // model can judge from the text and we cannot.
  return `${base} If the message mixes languages, reply in the one it mostly uses.`;
}

/**
 * Writing guidance for the detected language.
 *
 * An English-only prompt produces Chinese that is grammatical and lifeless:
 * the model reaches for textbook register, translates English idiom literally
 * ("Hey, can we chat?" becomes a stiff 「嗨，我们能聊聊吗？」), and drops the
 * sentence-final particles that carry almost all of the warmth in casual
 * Chinese. The tone setting is then doing nothing, because the thing that
 * makes Chinese sound warm is not vocabulary.
 *
 * Only the languages the app ships UI for carry specific notes. Everything
 * else gets the general rule, which is still better than silence.
 */
const WRITING_NOTES = {
  zh: [
    "Write natural, spoken Modern Chinese — what one partner actually types to another, not written or translated prose.",
    "Carry the tone with sentence-final particles and softeners (吧, 呀, 啊, 呢, 嘛, 其实, 要不), not with added words of praise. These do most of the work that English does with 'just', 'maybe' and 'a bit'.",
    "Do not translate English phrasing literally. There is no natural Chinese equivalent of an opener like \"Hey\" — drop it rather than rendering it as 嗨.",
    "Use 你 unless the sender used 您. Never switch between them.",
    "Keep it concise. A Chinese rewrite that runs much longer than the original reads as a lecture.",
    "Match the sender's own script: do not convert Simplified to Traditional or back.",
  ],
  ja: [
    "Write natural spoken Japanese and keep the sender's politeness level (plain or です/ます) — switching register changes the relationship, not just the tone.",
    "Carry warmth with sentence-final particles (ね, よ, かな) rather than added words.",
  ],
  ko: [
    "Write natural spoken Korean and keep the sender's speech level (반말 or 해요/습니다). Changing it changes the relationship.",
  ],
};

/**
 * Language-specific writing notes for a prompt, or "" when there are none.
 * Returned as its own block so the caller can place it after the tone.
 */
export function writingNotes(text) {
  const detected = detectLanguage(text);
  if (!detected.confident || !detected.code) return "";

  // zh-CN and zh-TW share one set of notes.
  const key = detected.code.startsWith("zh") ? "zh" : detected.code;
  const notes = WRITING_NOTES[key];
  if (!notes) return "";

  return [`Writing in ${detected.name || key}:`, ...notes.map((n) => `- ${n}`)].join("\n");
}
