/**
 * Single source of truth for topics.
 *
 * The key list, keyword map and display labels previously lived in three
 * separate files. A topic present in one but missing from the keyword map was
 * accepted as a Red boundary and then silently never matched — a fail-open
 * violation of the app's core guarantee. One record per topic makes that drift
 * impossible, and `tests/topics.test.js` enforces coverage.
 */

export const TOPICS = [
  {
    key: "health",
    label: "Health",
    keywords: [
      "health", "healthy", "doctor", "hospital", "sick", "illness",
      "medicine", "medication", "therapy", "therapist", "mental health",
      "anxiety", "depression", "diagnosis", "symptoms", "treatment",
      "medical", "clinic", "surgery", "pain", "hurting", "feeling down",
      "stressed", "burnout", "exhausted", "insomnia", "sleep",
      "panic attack", "counselor", "psychiatrist", "prescription",
      "check-up", "test results", "condition", "chronic",
    ],
  },
  {
    key: "work",
    label: "Work",
    keywords: [
      "work", "job", "boss", "office", "career", "colleague", "coworker",
      "meeting", "promotion", "fired", "quit", "salary", "workplace",
      "manager", "project", "deadline", "interview", "resume",
      "layoff", "laid off", "overtime", "commute", "client",
      "performance review", "coworkers", "hired", "hiring",
      "remote work", "work from home", "shift", "business",
    ],
  },
  {
    key: "money",
    label: "Money",
    keywords: [
      "money", "budget", "debt", "credit card", "loan", "mortgage",
      "savings", "expenses", "bills", "financial", "rent", "salary",
      "bank", "invest", "spending", "afford", "cost", "price",
      "raise", "owe", "save more",
      "how much", "worth", "pay", "paid", "paying", "payment",
      "earn", "earning", "income", "expensive", "cheap",
      "purchase", "bought", "buying", "fee", "fees",
      "tax", "taxes", "profit", "revenue", "charge", "charged",
      "overdraft", "broke", "bankruptcy", "insurance",
      "subscription", "refund", "tip", "wage", "wages",
      "tuition", "down payment", "interest rate", "balance",
      "account", "transaction", "transfer",
    ],
  },
  {
    key: "family",
    label: "Family",
    keywords: [
      "family", "mother", "father", "mom", "dad", "parent", "sibling",
      "brother", "sister", "in-law", "mother-in-law", "father-in-law",
      "grandparent", "aunt", "uncle", "cousin", "relative",
      "holidays", "thanksgiving", "christmas",
      "grandma", "grandpa", "nephew", "niece", "stepmother",
      "stepfather", "stepmom", "stepdad", "half-sister", "half-brother",
      "family reunion", "inheritance", "my parents", "your parents",
      "his family", "her family", "their family", "the family",
    ],
  },
  {
    key: "intimacy",
    label: "Intimacy",
    // Trimmed: "touch" fired on "get in touch" and "touch base",
    // "connection" on "our internet connection" — in an app whose own core
    // noun is a connection — "physical" on "physical therapy" and "spark" on
    // "spark plugs". The keyword pass hard-blocks a red topic before the AI
    // ever sees the message, so an over-broad word here is not a harmless
    // extra check: it silently stops ordinary messages.
    keywords: [
      "intimacy", "intimate", "affection", "romance", "romantic",
      "physical intimacy", "desire", "attraction", "bedroom", "closeness",
      "cuddle", "cuddling", "kiss", "kissing", "touch me", "touching",
      "passion", "chemistry", "love life", "turned on", "sexy",
      "flirt", "flirting", "date night", "make love", "foreplay",
    ],
  },
  {
    key: "future_plans",
    label: "Future Plans",
    keywords: [
      "future", "plan", "plans", "moving", "relocate", "children",
      "kids", "baby", "marriage", "wedding", "retire", "retirement",
      "house", "apartment", "goal", "goals",
      "next year", "five year", "long term", "settle down",
      "engagement", "engaged", "proposal", "pregnant", "expecting",
      "career change", "dream", "ambition", "someday", "eventually",
      "start a family", "buy a house", "move to",
    ],
  },
  {
    key: "past_conflicts",
    label: "Past Conflicts",
    keywords: [
      "fight", "argument", "argued", "fighting", "conflict",
      "disagreement", "last time", "remember when", "you always",
      "you never", "that time", "tense", "tension", "resentment",
      "apologize", "apology", "sorry about", "forgive", "blame",
      "blamed", "yelled", "yelling", "screamed", "angry at you",
      "angry at me", "what you said", "what i said", "that argument",
      "still upset", "brought it up", "let it go", "get over it",
      "we never resolved",
    ],
  },
  {
    key: "social_life",
    label: "Social Life",
    keywords: [
      "friends", "social", "party", "going out", "hanging out",
      "weekend plans", "vacation", "trip", "travel",
      "invited", "invitation", "gathering", "bar", "club",
      "concert", "event", "festival", "get together", "night out",
      "girls night", "guys night", "my friends", "your friends",
      "plans tonight", "plans this weekend", "road trip", "fly out",
    ],
  },
  {
    key: "parenting",
    label: "Parenting",
    keywords: [
      "parenting", "discipline", "school", "homework", "daycare",
      "babysitter", "bedtime", "screen time", "allowance",
      "our kid", "our child", "the kids", "the children",
      "teacher", "grades", "report card", "behavior",
      "grounded", "punishment", "rules for", "chores",
      "tantrum", "nanny", "pediatrician", "playground",
      "soccer practice", "piano lesson", "pick up from school",
    ],
  },
  {
    key: "personal_growth",
    label: "Personal Growth",
    keywords: [
      "self-improvement", "growth", "hobby", "hobbies", "exercise",
      "gym", "diet", "weight", "learning", "class", "course",
      "meditation", "mindfulness", "journal", "journaling",
      "self-care", "boundaries", "therapy", "coaching",
      "new skill", "reading", "volunteer", "habit", "routine",
      "working on myself", "trying to be better",
    ],
  },
  /*
   * The topics below were added after the first ten. Each one is a subject
   * people in a close relationship commonly want handled carefully, and each
   * is phrased as a subject rather than a stance — a boundary is the
   * receiver's own protection, so "Politics & beliefs" is a topic someone can
   * put off-limits, never a position the app takes.
   *
   * Keywords are kept specific. The matcher anchors on word boundaries, but a
   * keyword that is also a common everyday word still produces blocks the
   * sender will not understand, so generic terms are left out deliberately.
   */
  {
    key: "body_and_appearance",
    label: "Body & Appearance",
    keywords: [
      "my body", "your body", "appearance", "weight",
      "gained weight", "lost weight", "fat", "thin", "skinny",
      "diet", "dieting", "calories", "clothes size", "dress size",
      "mirror", "wrinkle", "wrinkles", "aging", "grey hair", "gray hair",
      "bald", "balding", "acne", "skin", "hair loss",
      "how I look", "how you look", "ugly", "put on weight",
    ],
  },
  {
    key: "grief_and_loss",
    label: "Grief & Loss",
    keywords: [
      "grief", "grieving", "mourning", "bereaved", "bereavement",
      "funeral", "memorial", "burial", "cremation", "casket",
      "passed away", "passing", "death", "died", "dying", "deceased",
      "loss", "lost him", "lost her", "lost them",
      "anniversary of", "miscarriage", "stillbirth",
      "terminal", "hospice", "palliative", "widow", "widower",
      "urn", "grave", "cemetery",
    ],
  },
  {
    key: "politics_and_beliefs",
    label: "Politics & Beliefs",
    keywords: [
      "politics", "political", "election", "vote", "voting", "voted",
      "president", "government", "senator", "congress", "parliament",
      "democrat", "republican", "liberal", "conservative",
      "religion", "religious", "church", "mosque", "synagogue", "temple",
      "faith", "god", "prayer", "praying", "scripture", "atheist",
      "protest", "immigration", "abortion", "gun control",
    ],
  },
  {
    key: "home_and_chores",
    label: "Home & Chores",
    keywords: [
      "chores", "chore", "dishes", "laundry", "vacuum", "vacuuming",
      "cleaning", "clean up", "tidy", "tidying", "mess", "messy",
      "trash", "garbage", "bins", "recycling",
      "dirty", "clutter", "cluttered", "housework", "household",
      "my turn", "your turn", "fair share", "do my part", "do your part",
      "left it out", "pick up after",
    ],
  },
  {
    key: "substances_and_habits",
    label: "Alcohol & Habits",
    keywords: [
      "drinking", "drank", "drunk", "alcohol", "beer", "wine", "whiskey",
      "hungover", "hangover", "sober", "sobriety", "relapse", "relapsed",
      "rehab", "recovery", "sponsor", "aa meeting",
      "smoking", "cigarette", "cigarettes", "vape", "vaping",
      "weed", "cannabis", "gambling", "gamble", "betting",
      "addiction", "addicted", "quit drinking", "cut back",
    ],
  },
  {
    key: "time_and_attention",
    label: "Time & Attention",
    keywords: [
      "always late", "running late", "kept me waiting", "waited for you",
      "on your phone", "on the phone", "screen time", "scrolling",
      "ignoring me", "ignored me", "not listening", "never listen",
      "quality time", "time together", "no time for",
      "busy with work", "too busy", "cancelled on me", "canceled on me",
      "last minute", "forgot our", "forgot about",
    ],
  },
  {
    key: "past_relationships",
    label: "Past Relationships",
    keywords: [
      "my ex", "your ex", "ex-wife", "ex-husband", "ex-girlfriend",
      "ex-boyfriend", "ex-partner", "divorce", "divorced", "separation",
      "previous relationship", "last relationship", "old flame",
      "jealous", "jealousy", "cheated", "cheating", "affair",
      "unfaithful", "infidelity", "trust issues", "broke up",
    ],
  },
];

export const TOPIC_KEYS = TOPICS.map((t) => t.key);

// A deliberately short default UI list. The full TOPIC_KEYS set is still used
// to detect keywords in outgoing messages; this list only decides which topics
// a user sees pinned by default in the AI-Tuning page. Everything else is
// available as a quick-add suggestion so the preset list stays uncluttered.
export const CORE_PRESET_KEYS = [
  "health",
  "money",
  "past_conflicts",
  "parenting",
  "personal_growth",
];

export function isCorePresetKey(key) {
  return CORE_PRESET_KEYS.includes(key);
}

const BY_KEY = new Map(TOPICS.map((t) => [t.key, t]));

export function getTopic(key) {
  return BY_KEY.get(key) ?? null;
}

export function isValidTopicKey(key) {
  return BY_KEY.has(key);
}

export function getTopicLabel(key) {
  return BY_KEY.get(key)?.label ?? key;
}

/**
 * Custom topics: user-entered boundaries beyond the preset ten. The label is
 * the user's words; the key is derived from it; the checker matches on the
 * label's own words, so a custom boundary is enforceable — storing one the
 * checker would silently skip is the fail-open bug this registry exists to
 * prevent.
 */
export const MAX_CUSTOM_TOPICS = 10;
export const CUSTOM_KEY_PREFIX = "custom_";

export function isCustomTopicKey(key) {
  return typeof key === "string" && key.startsWith(CUSTOM_KEY_PREFIX);
}

/**
 * @returns {{ok: true, label: string, key: string} | {ok: false, error: string}}
 *   `error` is user-facing and names the fix.
 */
export function sanitizeCustomTopic(rawLabel) {
  const cleaned = String(rawLabel ?? "")
    .replace(/[^a-zA-Z0-9\s_-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30)
    .trim();

  if (cleaned.length < 2) {
    return { ok: false, error: "Give the topic a short name — letters and numbers, at least 2 characters." };
  }

  const key = CUSTOM_KEY_PREFIX + cleaned.toLowerCase().replace(/[\s-]+/g, "_");
  if (isValidTopicKey(cleaned.toLowerCase().replace(/[\s-]+/g, "_"))) {
    return { ok: false, error: "That topic already exists as a preset — set its level directly." };
  }
  return { ok: true, label: cleaned, key };
}

// The label's own words are the keyword list. Short words ("of", "my") would
// match everything, so only words of 3+ characters count, plus the full
// phrase for multi-word labels.
export function customTopicKeywords(sanitizedLabel) {
  const label = String(sanitizedLabel ?? "").toLowerCase().trim();
  if (!label) return [];
  const words = label.split(/\s+/).filter((w) => w.length >= 3);
  return label.includes(" ") ? [label, ...words] : words.length ? words : [label];
}
