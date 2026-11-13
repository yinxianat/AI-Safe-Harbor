// Lightweight translation table. Adding a language = adding a column.
// Key design: translation keys describe meaning, not the English wording,
// so an English copy-polish does not break every other language.

export const TRANSLATIONS = {
  en: {
    tagline: "Give each other room.",
    sign_in_hint: "We'll email you a sign-in link. No password needed.",
    email_label: "Email",
    email_placeholder: "you@example.com",
    send_link: "Email me a sign-in link",
    sending: "Sending…",
    check_email_title: "Check your email",
    sent_to: "We sent a sign-in link to",
    link_valid: "It usually arrives within a minute. The link works for 15 minutes.",
    spam_hint: "Not there yet? Check your spam or promotions folder.",
    send_again: "send it again",
    use_other: "Use a different email",
    china_notice: "Gmail blocked in China? Use a QQ, 163, Outlook, or other non-Gmail email to receive the sign-in link.",
    install_title: "Install Leeway on your phone",
    install_iphone: "iPhone (Safari):",
    install_android: "Android (Chrome):",
    what_is: "What is Leeway?",
    nav_circle: "Circle",
    nav_chat: "Chat",
    nav_me: "Me",
    language: "Language",
    sign_out: "Sign out",
    conversations: "Conversations",
    your_circle: "Your Circle",
    circle_blurb: "Your people and how you relate to each of them.",
    message: "Message",
    profile: "Profile",
    ai_tuning: "AI Tuning",
    disconnect: "Disconnect",
  },
  "zh-CN": {
    tagline: "给彼此一些空间。",
    sign_in_hint: "我们将通过电子邮件发送登录链接，无需密码。",
    email_label: "电子邮箱",
    email_placeholder: "you@example.com",
    send_link: "发送登录链接到我的邮箱",
    sending: "发送中…",
    check_email_title: "请查看您的邮箱",
    sent_to: "我们已将登录链接发送至",
    link_valid: "通常会在一分钟内收到。链接有效期为 15 分钟。",
    spam_hint: "还没收到？请检查您的垃圾邮件或推广邮件文件夹。",
    send_again: "重新发送",
    use_other: "使用其他邮箱",
    china_notice: "Gmail 在中国无法访问？请使用 QQ、163、Outlook 等非 Gmail 邮箱接收登录链接。",
    install_title: "将 Leeway 添加到主屏幕",
    install_iphone: "iPhone（Safari 浏览器）：",
    install_android: "安卓（Chrome 浏览器）：",
    what_is: "什么是 Leeway？",
    nav_circle: "圈子",
    nav_chat: "聊天",
    nav_me: "我",
    language: "语言",
    sign_out: "退出登录",
    conversations: "对话",
    your_circle: "我的圈子",
    circle_blurb: "您圈子中的人以及您与他们的关系。",
    message: "消息",
    profile: "资料",
    ai_tuning: "AI 调整",
    disconnect: "断开连接",
  },
};

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "zh-CN", label: "中文" },
];

export function translate(locale, key) {
  const dict = TRANSLATIONS[locale] || TRANSLATIONS.en;
  return dict[key] || TRANSLATIONS.en[key] || key;
}
