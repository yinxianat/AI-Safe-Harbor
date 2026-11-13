"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/context.js";

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
      <div className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
        {n}
      </div>
      <p className="font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">{children}</p>
    </div>
  );
}

export default function AboutPage() {
  const { t } = useT();
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-12 sm:py-16">

      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">{t("app_name")}</h1>
        <p className="mt-2 text-lg text-slate-500">{t("about_tagline")}</p>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-slate-700">
          {t("about_intro")}
        </p>
      </header>

      <section className="mt-14">
        <h2 className="text-xl font-bold text-slate-900">{t("about_problem_title")}</h2>
        <p className="mt-3 text-base leading-relaxed text-slate-700">{t("about_problem_1")}</p>
        <p className="mt-3 text-base leading-relaxed text-slate-700">{t("about_problem_2")}</p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold text-slate-900">{t("about_how_title")}</h2>
        <div className="mt-6 space-y-7">
          <Step n="1" title={t("about_step_1_title")}>{t("about_step_1_body")}</Step>
          <Step n="2" title={t("about_step_2_title")}>{t("about_step_2_body")}</Step>
          <Step n="3" title={t("about_step_3_title")}>{t("about_step_3_body")}</Step>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold text-slate-900">{t("about_settings_title")}</h2>
        <p className="mt-2 text-sm text-slate-500">{t("about_settings_hint")}</p>
        <div className="mt-6 space-y-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <Light color="green" title={t("about_open_title")}>{t("about_open_body")}</Light>
          <Light color="yellow" title={t("about_gentle_title")}>{t("about_gentle_body")}</Light>
          <Light color="red" title={t("about_notready_title")}>{t("about_notready_body")}</Light>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold text-slate-900">{t("about_never_title")}</h2>
        <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <p className="text-sm leading-relaxed text-slate-700">
            <strong className="text-slate-900">{t("about_never_raw_bold")}</strong>{" "}
            {t("about_never_raw_body")}
          </p>
          <p className="text-sm leading-relaxed text-slate-700">
            <strong className="text-slate-900">{t("about_never_past_bold")}</strong>{" "}
            {t("about_never_past_body")}
          </p>
          <p className="text-sm leading-relaxed text-slate-700">
            <strong className="text-slate-900">{t("about_never_unreviewed_bold")}</strong>{" "}
            {t("about_never_unreviewed_body")}
          </p>
          <p className="text-sm leading-relaxed text-slate-700">
            <strong className="text-slate-900">{t("about_never_advice_bold")}</strong>{" "}
            {t("about_never_advice_body")}
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold text-slate-900">{t("about_beyond_title")}</h2>
        <div className="mt-5 space-y-5">
          <div className="flex gap-4">
            <div className="mt-1 h-8 w-8 shrink-0 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600 text-sm font-bold">K</div>
            <div>
              <p className="font-semibold text-slate-800">{t("about_knowme_title")}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{t("about_knowme_body")}</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="mt-1 h-8 w-8 shrink-0 rounded-lg bg-teal-100 flex items-center justify-center text-teal-600 text-sm font-bold">P</div>
            <div>
              <p className="font-semibold text-slate-800">{t("about_practice_title")}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{t("about_practice_body")}</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="mt-1 h-8 w-8 shrink-0 rounded-lg bg-pink-100 flex items-center justify-center text-pink-600 text-sm font-bold">C</div>
            <div>
              <p className="font-semibold text-slate-800">{t("about_circle_title")}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{t("about_circle_body")}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold text-slate-900">{t("about_who_title")}</h2>
        <p className="mt-3 text-base leading-relaxed text-slate-700">{t("about_who_1")}</p>
        <p className="mt-3 text-base leading-relaxed text-slate-700">{t("about_who_2")}</p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold text-slate-900">{t("about_privacy_title")}</h2>
        <p className="mt-3 text-base leading-relaxed text-slate-700">{t("about_privacy_body")}</p>
      </section>

      <div className="mt-14 rounded-2xl bg-emerald-600 px-6 py-8 text-center">
        <p className="text-lg font-semibold text-white">{t("about_cta_title")}</p>
        <p className="mt-1 text-sm text-emerald-100">{t("about_cta_body")}</p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-xl bg-white px-6 py-3 font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
        >
          {t("about_cta_button")}
        </Link>
      </div>

      <p className="mt-10 text-center text-xs text-slate-400">{t("about_footer")}</p>
    </div>
  );
}
