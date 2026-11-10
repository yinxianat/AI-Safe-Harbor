import Link from "next/link";

export const metadata = {
  title: "What is Leeway?",
  description:
    "Leeway is a private space for two people. Set what you're open to talking about, then say the hard things in a way your person can actually hear.",
};

function Light({ color, title, children }) {
  const ring = {
    green: "bg-emerald-500 ring-emerald-100",
    yellow: "bg-amber-400 ring-amber-100",
    red: "bg-red-500 ring-red-100",
  }[color];

  return (
    <div className="flex gap-4">
      <div className={`mt-1 h-5 w-5 shrink-0 rounded-full ring-4 ${ring}`} />
      <div>
        <p className="font-semibold text-slate-800">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{children}</p>
      </div>
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <div className="relative pl-12">
      <div className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
        {n}
      </div>
      <p className="font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">{children}</p>
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-12 sm:py-16">

      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Leeway</h1>
        <p className="mt-2 text-lg text-slate-500">Give each other room.</p>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-slate-700">
          A private space for two people. You decide what you&rsquo;re open to talking
          about. Then you can say the hard things in a way your person can actually
          hear &mdash; instead of in the words that came out first.
        </p>
      </header>

      <section className="mt-14">
        <h2 className="text-xl font-bold text-slate-900">The problem</h2>
        <p className="mt-3 text-base leading-relaxed text-slate-700">
          With the person closest to you, the gap between{" "}
          <em>what you meant</em> and <em>what landed</em> is where most damage
          happens. You were tired, so it came out sharp. They were already worn down
          by that exact topic, so it hit harder than you knew.
        </p>
        <p className="mt-3 text-base leading-relaxed text-slate-700">
          Neither of you did anything wrong. The message just arrived at the wrong
          moment, in the wrong shape.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold text-slate-900">How it works</h2>
        <div className="mt-6 space-y-7">
          <Step n="1" title="Say what you have room for">
            For each topic &mdash; money, family, work, health and others &mdash; you
            set how open you are right now. This is about what you{" "}
            <strong>receive</strong>, and only your partner&rsquo;s settings affect
            what reaches you.
          </Step>
          <Step n="2" title="Write it however it comes out">
            Type what you actually feel. No editing yourself, no rehearsing. The
            unfiltered version is only ever shown back to you.
          </Step>
          <Step n="3" title="Review, then send">
            You see your words and a tuned version side by side, matched to how your
            partner prefers to be spoken to. You choose whether to send. Nothing
            leaves without you approving it.
          </Step>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold text-slate-900">Your three settings</h2>
        <p className="mt-2 text-sm text-slate-500">
          Tap any topic to cycle through them. Change them whenever you like.
        </p>
        <div className="mt-6 space-y-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <Light color="green" title="Open">
            Fair game. Messages come through tuned to your preferred tone.
          </Light>
          <Light color="yellow" title="Gentle">
            Still welcome, but handled with care. Leeway softens the edges before it
            reaches you.
          </Light>
          <Light color="red" title="Not ready">
            Held, not delivered. Your partner is told the topic is sensitive right
            now &mdash; never what they would have said, and never that you are
            avoiding them.
          </Light>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold text-slate-900">What Leeway will never do</h2>
        <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <p className="text-sm leading-relaxed text-slate-700">
            <strong className="text-slate-900">Never send your raw words.</strong>{" "}
            Your partner only ever sees the version you reviewed and approved. What you
            originally typed is never shared with them.
          </p>
          <p className="text-sm leading-relaxed text-slate-700">
            <strong className="text-slate-900">
              Never deliver past a &ldquo;not ready&rdquo;.
            </strong>{" "}
            A held message stays held. It is never quietly let through.
          </p>
          <p className="text-sm leading-relaxed text-slate-700">
            <strong className="text-slate-900">Never send unreviewed.</strong> If
            the tuning service is unavailable, your message is saved as a draft and
            nothing is sent. We would rather be late than get this wrong.
          </p>
          <p className="text-sm leading-relaxed text-slate-700">
            <strong className="text-slate-900">Never give advice.</strong> Leeway
            rephrases what you said. It does not add opinions, counsel you, or take
            a side.
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold text-slate-900">Who it&rsquo;s for</h2>
        <p className="mt-3 text-base leading-relaxed text-slate-700">
          Two people who matter to each other and want to keep it that way. Partners,
          spouses, a parent and a grown child, two close friends going through
          something heavy. Anyone where getting it wrong is expensive.
        </p>
        <p className="mt-3 text-base leading-relaxed text-slate-700">
          It is not a group chat, not a social network, and not therapy. One
          connection, two people, nobody else.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold text-slate-900">Privacy</h2>
        <p className="mt-3 text-base leading-relaxed text-slate-700">
          There are no passwords &mdash; you sign in with a link sent to your email,
          so there is no password to leak. Your messages are visible only to you and
          the one person you connect with. Your boundary settings are yours; your
          partner sees that a topic is sensitive, not a log of how you have ranked
          them over time.
        </p>
      </section>

      <div className="mt-14 rounded-2xl bg-indigo-600 px-6 py-8 text-center">
        <p className="text-lg font-semibold text-white">
          Say the hard thing. Carefully.
        </p>
        <p className="mt-1 text-sm text-indigo-100">
          Takes a minute to set up. No password required.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-xl bg-white px-6 py-3 font-medium text-indigo-700 transition-colors hover:bg-indigo-50"
        >
          Get started
        </Link>
      </div>

      <p className="mt-10 text-center text-xs text-slate-400">
        Leeway &mdash; a private space for two.
      </p>
    </div>
  );
}
