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
      // Chinese (Simplified and Traditional where they differ).
      "健康", "医生", "醫生", "医院", "醫院", "生病", "病了", "吃药",
      "吃藥", "药", "藥", "治疗", "治療", "心理", "焦虑", "焦慮",
      "抑郁", "抑鬱", "失眠", "体检", "體檢", "手术", "手術", "疼",
      "痛", "累", "疲劳", "疲勞", "症状", "症狀", "诊断", "診斷",
      "复诊", "複診",
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
      // Chinese (Simplified and Traditional where they differ).
      "工作", "上班", "加班", "老板", "老闆", "同事", "公司", "职场",
      "職場", "会议", "會議", "升职", "升職", "辞职", "辭職", "被裁",
      "裁员", "裁員", "面试", "面試", "项目", "項目", "截止", "绩效",
      "績效", "出差", "离职", "離職", "工资", "工資",
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
      // Chinese (Simplified and Traditional where they differ).
      "钱", "錢", "花钱", "花錢", "预算", "預算", "债", "債",
      "欠", "贷款", "貸款", "房贷", "房貸", "存款", "账单", "帳單",
      "账户", "帳戶", "财务", "財務", "房租", "租金", "工资", "工資",
      "薪水", "收入", "支出", "消费", "消費", "贵", "貴", "便宜",
      "买房", "買房", "付款", "报销", "報銷", "税", "稅", "理财",
      "理財", "投资", "投資", "保险", "保險", "学费", "學費",
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
      // Chinese (Simplified and Traditional where they differ).
      "家", "家人", "家庭", "妈", "媽", "妈妈", "媽媽", "爸",
      "爸爸", "父母", "兄弟", "姐妹", "哥", "弟", "姐", "妹",
      "公婆", "婆婆", "岳母", "岳父", "亲戚", "親戚", "娘家", "婚礼",
      "婚禮", "过年", "過年",
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
      // Chinese (Simplified and Traditional where they differ).
      "亲密", "親密", "亲热", "親熱", "浪漫", "拥抱", "擁抱", "抱抱",
      "接吻", "亲亲", "親親", "做爱", "做愛", "性生活", "情欲", "情慾",
      "约会", "約會", "调情", "調情", "撒娇", "撒嬌", "暧昧", "曖昧",
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
      // Chinese (Simplified and Traditional where they differ).
      "将来", "將來", "未来", "未來", "以后", "以後", "计划", "計劃",
      "打算", "结婚", "結婚", "买房", "買房", "搬家", "移民", "要孩子",
      "生孩子", "养老", "養老", "退休", "五年后", "五年後",
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
      // Chinese (Simplified and Traditional where they differ).
      "吵架", "争吵", "爭吵", "上次", "那次", "以前说过", "以前說過", "旧事",
      "舊事", "翻旧账", "翻舊帳", "道歉", "原谅", "原諒", "误会", "誤會",
      "伤害", "傷害", "记仇", "記仇", "冷战", "冷戰",
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
      // Chinese (Simplified and Traditional where they differ).
      "朋友", "聚会", "聚會", "应酬", "應酬", "出去玩", "喝酒局", "饭局",
      "飯局", "社交", "同学", "同學", "群", "约人", "約人",
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
      // Chinese (Simplified and Traditional where they differ).
      "孩子", "小孩", "儿子", "兒子", "女儿", "女兒", "宝宝", "寶寶",
      "带娃", "帶娃", "育儿", "育兒", "上学", "上學", "学校", "學校",
      "老师", "老師", "作业", "作業", "补习", "補習", "教育", "管孩子",
      "家长会", "家長會",
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
      // Chinese (Simplified and Traditional where they differ).
      "自我", "成长", "成長", "健身", "运动", "運動", "减肥", "減肥",
      "体重", "體重", "饮食", "飲食", "学习", "學習", "课程", "課程",
      "冥想", "正念", "日记", "日記", "习惯", "習慣", "爱好", "愛好",
      "自律", "进步", "進步",
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
      // Chinese (Simplified and Traditional where they differ).
      "身材", "外貌", "长相", "長相", "胖", "瘦", "体重", "體重",
      "减肥", "減肥", "卡路里", "皱纹", "皺紋", "皱", "變老", "变老",
      "衰老", "白头发", "白頭髮", "秃", "禿", "痘", "皮肤", "皮膚",
      "脱发", "脫髮", "丑", "醜", "穿衣", "尺码", "尺碼",
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
      // Chinese (Simplified and Traditional where they differ).
      "去世", "过世", "過世", "走了", "离世", "離世", "葬礼", "葬禮",
      "丧", "喪", "追悼", "墓", "坟", "墳", "骨灰", "哀悼",
      "悲伤", "悲傷", "思念", "忌日", "周年", "流产", "流產", "临终",
      "臨終", "绝症", "絕症", "安宁疗护", "安寧療護",
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
      // Chinese (Simplified and Traditional where they differ).
      "政治", "选举", "選舉", "投票", "政府", "总统", "總統", "党",
      "黨", "宗教", "信仰", "教会", "教會", "上帝", "神", "佛",
      "拜佛", "祈祷", "祈禱", "念经", "念經", "无神论", "無神論", "抗议",
      "抗議", "移民政策",
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
      // Chinese (Simplified and Traditional where they differ).
      "家务", "家務", "做饭", "做飯", "洗碗", "洗衣", "扫地", "掃地",
      "水池", "水槽", "碗没洗", "碗沒洗",
      "拖地", "打扫", "打掃", "收拾", "垃圾", "倒垃圾", "乱", "亂",
      "脏", "臟", "髒", "整理", "该你了", "該你了", "我的份", "轮到",
      "輪到",
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
      // Chinese (Simplified and Traditional where they differ).
      "喝酒", "酒", "醉", "宿醉", "戒酒", "戒烟", "戒菸", "抽烟",
      "抽菸", "烟", "菸", "香烟", "香菸", "电子烟", "電子菸", "赌",
      "賭", "赌博", "賭博", "上瘾", "上癮", "成瘾", "成癮", "戒断",
      "戒斷", "复发", "復發", "康复", "康復", "毒",
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
      // Chinese (Simplified and Traditional where they differ).
      "迟到", "遲到", "等你", "让我等", "讓我等", "玩手机", "玩手機", "看手机",
      "看手機", "刷手机", "刷手機", "不听", "不聽", "没在听", "沒在聽", "忽视",
      "忽視", "不理我", "陪我", "陪伴", "没时间", "沒時間", "太忙", "临时取消",
      "臨時取消", "忘了",
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
      // Chinese (Simplified and Traditional where they differ).
      "前任", "前男友", "前女友", "前夫", "前妻", "离婚", "離婚", "分手",
      "出轨", "出軌", "外遇", "劈腿", "吃醋", "嫉妒", "不忠", "信任",
      "旧情", "舊情", "以前的对象", "以前的對象",
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
