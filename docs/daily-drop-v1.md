# OVRLEE — Daily Drop V1

## What it is
One @ovrlee question a day, answered with songs. At the end of the day the
answers are the playlist: "Today's Drop."

- A Daily Drop is an ordinary feed post with `post_kind='daily_drop'`.
- It reuses Song Replies exactly — reply with a song, optional note, artwork,
  preview, link to your own music service. No new reply type, no new composer.
- The home feed shows a Daily Drop card at the top, with one action:
  "Reply with a song." It opens the post with the Song Reply composer open.
- `/daily-drop` shows today's question, its Song Replies in order, and the
  playlist they make. Sharing uses the existing post share, so a recipient
  lands on the Drop post itself.
- The playlist is a list of links out to each listener's own music service.
  OVRLEE hosts no audio and copies no audio.

## Question library
21 questions in `src/daily-drop.ts` (`DAILY_DROP_QUESTIONS`) and in the
migration's `private.ovrlee_daily_drop_templates` table. They are distinct
from the 28 Aux questions. The question for a date is deterministic
(`questionForDate`), so every device agrees on today's Drop.

## Automatic posting: OFF by default
The migration creates `private.ovrlee_daily_drop_config` with
`enabled=false`, a publications table (one post per local date), and
`private.ovrlee_publish_daily_drop(date)`, modelled on the existing Aux
publisher. It returns null while disabled and refuses any date other than
today (America/New_York).

Do NOT enable it until:
- a named moderator and a response cadence for reports exist;
- the Drop card and `/daily-drop` screen have passed on a real iPhone;
- the timezone / DST behaviour of the schedule has been confirmed.

Manual alternative, recommended for beta: a moderator publishes one
question a day by hand as @ovrlee, 2–3 times a week to start, only if the
questions generate genuine Song Replies. Never fabricate replies.

## Migration status — NOT APPLIED
`supabase/migrations/20261123000000_daily_drop.sql` is committed in this
branch only. It has NOT been applied to live Supabase. Applying it needs
Chanel's approval and a Supabase apply step (CLI / dashboard). Until then,
`post_kind='daily_drop'` posts cannot be inserted by the database check
constraint, and the app code handles a missing Drop gracefully (the card
simply does not show, and `/daily-drop` shows today's question with a
"no Drop published yet" note).

## Acceptance test (on a real iPhone, after the migration is applied)
1. Publish today's Drop manually or enable the flag for one day only.
2. Open Home: the Daily Drop card is at the top, with today's question.
3. Tap "Reply with a song", pick a song, send with no text. Check it appears
   with artwork, title and artist, and in the playlist on `/daily-drop`.
4. Reply again from a second account with the same song — the playlist
   lists it once, credited to the first reply.
5. Share today's Drop: the recipient lands on the Drop post.
6. Next day, a new question appears and yesterday's playlist stays on
   yesterday's post.
