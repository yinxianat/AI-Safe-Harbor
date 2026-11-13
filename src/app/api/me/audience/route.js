import { getSessionUser } from "@/lib/auth.js";
import prisma from "@/lib/db.js";
import { loadContactsWithBoundaries } from "@/lib/profile-contacts.js";
import { textForViewer } from "@/lib/profile-audience.js";
import { checkTopicBoundaries } from "@/lib/topic-checker.js";
import { getTopicLabel } from "@/lib/topics.js";
import { visibilityState } from "@/lib/audience-visibility.js";

/**
 * Everything about the signed-in user, rendered once per contact exactly as
 * that contact would read it.
 *
 * The app already decides visibility per connection on every read path
 * (`/api/partner`, `/api/wall`, `/api/knowme`), but each of those answers for
 * one viewer at a time, so the author could never see the whole picture — the
 * same status could read "doing fine" to one person and be hidden from
 * another with no screen that says so. This endpoint inverts that: one
 * payload holding every audience's version side by side.
 *
 * It deliberately reports hidden items too, with the reason, because the
 * point is to let the author correct a visibility choice they did not mean
 * to make. Hiding the hidden ones would hide exactly what they came to find.
 */

const WALL_LIMIT = 50;

/** Red topics of `contact` that `text` trips, as display labels. */
function blockedTopicLabels(text, contact) {
  const check = checkTopicBoundaries(text, contact.topicSettings || []);
  const keys = [...(check.redTopics || []), ...(check.redTopicsWithNote || [])];
  return keys.map((key) => ({ key, label: getTopicLabel(key) }));
}

/**
 * `visibilityState` plus the topics behind a block.
 *
 * The topics are attached even when the item was withheld by the author's own
 * audience choice, because re-adding a contact whose boundary also rejects the
 * text would look like it worked and change nothing.
 */
function visibilityFor(item, contact, text) {
  const state = visibilityState(item, contact.connectionId);
  return {
    ...state,
    blockedTopics: state.reason === "private" || state.shown
      ? []
      : blockedTopicLabels(text, contact),
  };
}

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const [contacts, posts, entries, prefs] = await Promise.all([
    loadContactsWithBoundaries(user.id),
    prisma.wallPost.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: WALL_LIMIT,
    }),
    prisma.knowMeEntry.findMany({
      where: { userId: user.id },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    // The author's own nickname for each contact — the name they recognise,
    // which is not necessarily the display name the contact chose.
    prisma.connectionPreference.findMany({
      where: { userId: user.id },
      select: { connectionId: true, nickname: true },
    }),
  ]);

  const nicknameByConnection = Object.fromEntries(
    prefs.filter((p) => p.nickname).map((p) => [p.connectionId, p.nickname])
  );

  const statusVisibleTo = user.statusVisibleTo || [];
  const allConnectionIds = contacts.map((c) => c.connectionId);

  const audiences = contacts.map((contact) => {
    const statusShown =
      statusVisibleTo.length === 0 || statusVisibleTo.includes(contact.connectionId);

    const postViews = posts.map((post) => {
      const text = textForViewer(post, contact.connectionId, "text");
      const v = visibilityFor(post, contact, post.text);
      return {
        id: post.id,
        text,
        shown: v.shown,
        reason: v.reason,
        blockedTopics: v.blockedTopics,
        // True when this contact reads an AI rewrite rather than the original,
        // which is the other way the same post can differ between audiences.
        tuned: text !== post.text,
        mood: post.mood,
        createdAt: post.createdAt,
        visibleTo: post.visibleTo || [],
      };
    });

    const knowMeViews = entries.map((entry) => {
      const answer = textForViewer(entry, contact.connectionId, "answer");
      const v = visibilityFor(entry, contact, `${entry.prompt}\n${entry.answer}`);
      return {
        id: entry.id,
        prompt: entry.prompt,
        answer,
        shown: v.shown,
        reason: v.reason,
        blockedTopics: v.blockedTopics,
        tuned: answer !== entry.answer,
        visibleTo: entry.visibleTo || [],
      };
    });

    return {
      connectionId: contact.connectionId,
      partnerId: contact.partnerId,
      name: contact.name,
      label: nicknameByConnection[contact.connectionId] || contact.name,
      avatarUrl: contact.avatarUrl || null,
      relationshipType: contact.relationshipType,
      tonePreference: contact.tonePreference,
      status: {
        shown: statusShown,
        text: statusShown ? user.statusText : null,
        updatedAt: statusShown ? user.statusUpdatedAt : null,
      },
      posts: postViews,
      knowMe: knowMeViews,
      counts: {
        postsShown: postViews.filter((p) => p.shown).length,
        postsHidden: postViews.filter((p) => !p.shown).length,
        knowMeShown: knowMeViews.filter((e) => e.shown).length,
        knowMeHidden: knowMeViews.filter((e) => !e.shown).length,
      },
    };
  });

  return Response.json({
    profile: {
      displayName: user.displayName,
      username: user.username,
      avatarUrl: user.avatarUrl || null,
    },
    statusText: user.statusText,
    statusVisibleTo,
    // The client needs the full set to turn "everyone" into an explicit
    // allow-list when the author hides one item from one person.
    allConnectionIds,
    audiences,
  });
}
