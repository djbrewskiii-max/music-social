-- Applied to hosted Supabase on 2026-11-18 (migration 20261118022425).
-- Tightens existing INSERT policy; no schema, grant, or client changes.
-- The original comparison m.conversation_id = conversation_id resolved to
-- the inner messages row on both sides. Explicitly qualify the report's
-- conversation_id, then require the current reporter to be a participant.
-- This is defense in depth alongside message SELECT RLS.
ALTER POLICY "Participants may report received messages"
ON public.message_reports
WITH CHECK (
  reporter_id = (select auth.uid())
  AND reporter_id <> reported_user_id
  AND status = 'open'
  AND EXISTS (
    SELECT 1
    FROM public.messages AS m
    JOIN public.conversations AS c ON c.id = m.conversation_id
    WHERE m.id = message_reports.message_id
      AND m.sender_id = message_reports.reported_user_id
      AND m.conversation_id = message_reports.conversation_id
      AND (
        (NOT c.is_group AND (select auth.uid()) IN (c.user_one, c.user_two))
        OR (c.is_group AND public.ovrlee_is_group_member(c.id))
      )
  )
);
