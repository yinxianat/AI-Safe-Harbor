import { detectLanguage, languageInstruction, writingNotes } from "../src/lib/ai/language.js";
import { buildSystemPrompt } from "../src/lib/ai/prompt.js";
import { validateRephrasedOutput } from "../src/lib/ai/safety.js";
import { checkTopicBoundaries, matchesKeyword } from "../src/lib/topic-checker.js";
import { TOPICS } from "../src/lib/topics.js";

/**
 * Language parity.
 *
 * The output language used to come from the RECEIVER's UI locale, so a
 * message typed in Chinese to someone whose app was set to English came back
 * in English — the sender's words replaced by a translation they never wrote,
 * delivered under their name. These tests pin the rule that the reply follows
 * the message.
 *
 * The rest of the file covers the three places Chinese was second-class:
 * keyword boundaries never fired, the output validator was blind to Chinese
 * refusals, and the prompt gave no register guidance.
 */

describe("detectLanguage", () => {
  it.each([
    ["我们需要谈谈预算", "zh-CN"],
    ["我們需要談談預算", "zh-TW"],
    ["こんにちは、今日は疲れた", "ja"],
    ["안녕하세요 오늘 피곤해요", "ko"],
    ["Нам нужно поговорить", "ru"],
    ["نحتاج أن نتحدث", "ar"],
    ["เราต้องคุยกัน", "th"],
  ])("identifies %j as %s", (text, code) => {
    const result = detectLanguage(text);
    expect(result.code).toBe(code);
    expect(result.confident).toBe(true);
  });

  // Han plus Kana is Japanese, not Chinese; the Kana settles it.
  it("does not mistake Japanese for Chinese", () => {
    expect(detectLanguage("今日は疲れた").code).toBe("ja");
  });

  // Script cannot separate English from Spanish, so it must not pretend to.
  it.each([
    ["We need to talk about the budget"],
    ["Necesitamos hablar del presupuesto"],
    ["Nous devons parler du budget"],
  ])("abstains on Latin script: %j", (text) => {
    const result = detectLanguage(text);
    expect(result.code).toBe("latin");
    expect(result.confident).toBe(false);
  });

  it.each([[""], ["   "], ["123 !!!"], [null], [undefined]])(
    "abstains on %j",
    (text) => {
      expect(detectLanguage(text).confident).toBe(false);
    }
  );

  it("keeps the dominant script of a mixed message", () => {
    expect(detectLanguage("我今天很累 but I still love you").code).toBe("zh");
  });
});

describe("languageInstruction", () => {
  it("always states the rule, even when detection abstains", () => {
    expect(languageInstruction("We need to talk")).toContain("SAME language");
    expect(languageInstruction("")).toContain("SAME language");
  });

  it("says it is rephrasing, not translating", () => {
    expect(languageInstruction("我们聊聊").toLowerCase()).toContain("never translating");
  });

  it("pins the language when the script identifies it", () => {
    expect(languageInstruction("我们需要谈谈")).toMatch(/so reply in Simplified Chinese/);
  });

  it("pins nothing for Latin script", () => {
    expect(languageInstruction("We need to talk")).not.toMatch(/so reply in/);
  });
});

describe("the prompt takes the output language from the message", () => {
  const pinned = (message, locale) => {
    const match = buildSystemPrompt({ tonePreference: "warm_and_gentle", locale }, message)
      .match(/so reply in ([^.]+)\./);
    return match ? match[1] : null;
  };

  // The regression: the receiver's locale decided the output language.
  it("replies in Chinese to a Chinese message even when the receiver reads English", () => {
    expect(pinned("我们需要谈谈预算", "en")).toMatch(/Simplified Chinese/);
  });

  it("does not force Chinese onto an English message when the receiver reads Chinese", () => {
    expect(pinned("We need to talk about the budget", "zh-CN")).toBeNull();
  });

  it("keeps Traditional script rather than converting it", () => {
    expect(pinned("我們需要談談預算", "zh-CN")).toMatch(/Traditional Chinese/);
  });

  it("ignores the receiver locale entirely", () => {
    const a = buildSystemPrompt({ tonePreference: "warm_and_gentle", locale: "en" }, "我们聊聊");
    const b = buildSystemPrompt({ tonePreference: "warm_and_gentle", locale: "zh-CN" }, "我们聊聊");
    expect(a).toBe(b);
  });
});

describe("writingNotes", () => {
  it("gives Chinese-specific register guidance", () => {
    const notes = writingNotes("我们需要谈谈预算");
    expect(notes).toContain("你");
    expect(notes).toMatch(/吧|呀|呢/);
  });

  it("tells the model not to translate English idiom literally", () => {
    expect(writingNotes("我们聊聊")).toMatch(/literally|嗨/);
  });

  it("adds nothing for Latin script, where the base prompt is already native", () => {
    expect(writingNotes("We need to talk")).toBe("");
  });

  it("adds nothing for a language it has no notes for", () => {
    expect(writingNotes("Нам нужно поговорить")).toBe("");
  });

  it("is included in the system prompt for a Chinese message", () => {
    const prompt = buildSystemPrompt({ tonePreference: "warm_and_gentle" }, "我们需要谈谈预算");
    expect(prompt).toContain("Writing in Simplified Chinese");
  });
});

describe("the output check works in Chinese", () => {
  const original = "我们需要谈谈钱的事情,我有点担心";

  // Previously every one of these was delivered to the receiver verbatim, as
  // if the sender had written it.
  it.each([
    ["好的,这是改写后的版本:我们聊聊钱吧"],
    ["作为一个AI,我无法改写这条消息"],
    ["抱歉,我不能帮你做这件事"],
    ["改写后:我们谈谈吧"],
    ["以下是更温和的版本:钱的事我们聊聊"],
    ["以下是更委婉的说法:我们聊聊"],
    ["我是一个语言模型,不能这样做"],
    ["这违反了我的使用政策"],
  ])("rejects %j", (text) => {
    expect(validateRephrasedOutput(text, original).ok).toBe(false);
  });

  /**
   * The harder half. 抱歉 and 对不起 are ordinary apologies, and
   * "我不能帮你搬家" is a real sentence — rejecting them would hold exactly
   * the messages this app exists to carry.
   */
  it.each([
    ["抱歉,我今晚来不了,工作太忙了", "an apology"],
    ["我不能帮你搬家,那天我有事", "'can't help you' with a real object"],
    ["我无法接受这样的安排", "'无法' with an ordinary verb"],
    ["对不起,昨天是我不对", "an apology"],
    ["我们聊聊钱的事吧,我有点担心", "an ordinary rewrite"],
    ["其实我今天挺累的,要不改天?", "softeners the tone guidance asks for"],
    ["你说得对:我确实忘了", "a colon in a real sentence"],
    ["改天再说吧", "短 reply"],
  ])("accepts %j (%s)", (text) => {
    expect(validateRephrasedOutput(text, original).ok).toBe(true);
  });
});

describe("topic boundaries work in Chinese", () => {
  // JS \b is defined on [A-Za-z0-9_], so a boundary-anchored pattern can
  // never match a Han character: every Chinese keyword was silently dead and
  // a red boundary looked configured while never firing once.
  it.each([
    ["我没钱了", "钱"],
    ["我们需要谈谈预算", "预算"],
    ["去看医生", "医生"],
    ["我妈妈来了", "妈妈"],
  ])("matches %j against the keyword %j", (message, keyword) => {
    expect(matchesKeyword(message, keyword)).toBe(true);
  });

  it("still anchors Latin keywords on word boundaries", () => {
    expect(matchesKeyword("however I am late", "owe")).toBe(false);
    expect(matchesKeyword("multiple options", "tip")).toBe(false);
  });

  it("gives every topic at least one Chinese keyword", () => {
    for (const topic of TOPICS) {
      const chinese = topic.keywords.filter((k) => /[一-鿿]/.test(k));
      expect(chinese.length).toBeGreaterThan(0);
    }
  });

  it.each([
    ["money", "我们需要谈谈钱的事"],
    ["money", "房贷压力很大"],
    ["health", "我明天去看医生"],
    ["family", "我妈妈下周来"],
    ["work", "老板又改了截止时间"],
    ["intimacy", "想抱抱你"],
    ["future_plans", "我们以后要不要买房"],
    ["past_conflicts", "我还在想上次吵架的事"],
    ["social_life", "周五朋友约我出去"],
    ["parenting", "孩子的作业还没做"],
    ["personal_growth", "我这周开始健身了"],
    ["body_and_appearance", "我今年胖了"],
    ["grief_and_loss", "葬礼在周四"],
    ["politics_and_beliefs", "你看选举结果了吗"],
    ["home_and_chores", "碗还在水池里"],
    ["home_and_chores", "家务该你做了"],
    ["substances_and_habits", "我戒酒三个月了"],
    ["time_and_attention", "你总是在玩手机"],
    ["past_relationships", "我前任昨天联系我了"],
  ])("red %s catches %j", (topicName, message) => {
    const result = checkTopicBoundaries(message, [{ topicName, comfortLevel: "red" }]);
    expect(result.allowed).toBe(false);
    expect(result.redTopics).toContain(topicName);
  });

  // The same noise floor the English keywords are held to.
  describe("does not block ordinary Chinese messages", () => {
    const everythingRed = TOPICS.map((t) => ({ topicName: t.key, comfortLevel: "red" }));

    it.each([
      ["早上好,希望你睡得好"],
      ["我在路上了,火车有点晚"],
      ["今天天气真不错"],
      ["晚上想看个电影吗"],
      ["谢谢你昨天帮我"],
      ["我爱你"],
      ["到了跟我说一声"],
      ["那本书我看完了"],
      ["我买了面包和鸡蛋"],
      ["我去买点水"],
    ])("lets %j through with every topic red", (message) => {
      const result = checkTopicBoundaries(message, everythingRed);
      expect(result.redTopics ?? []).toEqual([]);
      expect(result.allowed).toBe(true);
    });
  });
});
