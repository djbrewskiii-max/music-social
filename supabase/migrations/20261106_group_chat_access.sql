-- OVRLEE: make group messaging compatible with existing direct conversations.
-- No message rows or existing conversations are deleted.

ALTER TABLE public.conversations ALTER COLUMN user_one DROP NOT NULL;
ALTER TABLE public.conversations ALTER COLUMN user_two DROP NOT NULL;
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_direct_or_group_shape;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_direct_or_group_shape
CHECK (
  (is_group = true AND user_one IS NULL AND user_two IS NULL AND created_by IS NOT NULL)
  OR
  (is_group = false AND user_one IS NOT NULL AND user_two IS NOT NULL)
);

-- This helper is deliberately narrowly scoped. It avoids recursive RLS queries
-- against conversation_members and never accepts an arbitrary user ID.
CREATE OR REPLACE FUNCTION public.ovrlee_is_group_member(p_conversation uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.conversation_members cm
      JOIN public.conversations c ON c.id = cm.conversation_id
      WHERE cm.conversation_id = p_conversation
        AND cm.user_id = (SELECT auth.uid())
        AND c.is_group = true
    );
$$;
REVOKE ALL ON FUNCTION public.ovrlee_is_group_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ovrlee_is_group_member(uuid) TO authenticated;

-- Keep existing 1:1 access, add membership-based group access.
DROP POLICY IF EXISTS "Users can read their conversations" ON public.conversations;
CREATE POLICY "Users can read their conversations" ON public.conversations
FOR SELECT TO authenticated
USING (
  ((NOT is_group) AND (auth.uid() = user_one OR auth.uid() = user_two))
  OR (is_group AND public.ovrlee_is_group_member(id))
);

DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations" ON public.conversations
FOR INSERT TO authenticated
WITH CHECK (
  NOT is_group AND (
    (auth.uid() = user_one AND NOT public.is_blocked_with(user_two))
    OR (auth.uid() = user_two AND NOT public.is_blocked_with(user_one))
  )
);

DROP POLICY IF EXISTS "Members can view their conversation memberships" ON public.conversation_members;
CREATE POLICY "Members can view their conversation memberships" ON public.conversation_members
FOR SELECT TO authenticated
USING (public.ovrlee_is_group_member(conversation_id));

-- Only the validated RPC adds group members. Users cannot join any group
-- by directly inserting their own membership rows.
DROP POLICY IF EXISTS "Members can add mutuals to groups" ON public.conversation_members;
CREATE POLICY "Members can add mutuals to groups" ON public.conversation_members
FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "Users can read conversation messages" ON public.messages;
CREATE POLICY "Users can read conversation messages" ON public.messages
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (
        (NOT c.is_group AND auth.uid() IN (c.user_one, c.user_two))
        OR (c.is_group AND public.ovrlee_is_group_member(c.id))
      )
  )
);

DROP POLICY IF EXISTS "Users can send conversation messages" ON public.messages;
CREATE POLICY "Users can send conversation messages" ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (
        (NOT c.is_group
          AND auth.uid() IN (c.user_one, c.user_two)
          AND NOT public.is_blocked_with(
            CASE WHEN c.user_one = auth.uid() THEN c.user_two ELSE c.user_one END
          ))
        OR (c.is_group AND public.ovrlee_is_group_member(c.id))
      )
  )
);

-- Validate EVERY invitee server-side, not only in the UI. Group chats are
-- restricted to people who follow each other; no silent arbitrary invites.
CREATE OR REPLACE FUNCTION public.create_group_chat(p_title text, p_member_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_conversation uuid;
  v_member uuid;
  v_members uuid[];
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT array_agg(DISTINCT member_id) INTO v_members
  FROM unnest(p_member_ids) AS member_id
  WHERE member_id IS NOT NULL AND member_id <> v_owner;
  IF coalesce(array_length(v_members, 1), 0) < 1 OR array_length(v_members, 1) > 20 THEN
    RAISE EXCEPTION 'Choose between 1 and 20 mutual followers';
  END IF;
  IF char_length(coalesce(p_title, '')) > 60 THEN
    RAISE EXCEPTION 'Group name is too long';
  END IF;
  FOREACH v_member IN ARRAY v_members LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.user_follows a
      JOIN public.user_follows b
        ON b.follower_id = v_member AND b.following_id = v_owner
      WHERE a.follower_id = v_owner AND a.following_id = v_member
    ) OR public.is_blocked_with(v_member)
    THEN
      RAISE EXCEPTION 'You can only invite mutual followers who are available for messaging';
    END IF;
  END LOOP;

  INSERT INTO public.conversations(is_group, title, created_by)
  VALUES (true, nullif(trim(p_title), ''), v_owner)
  RETURNING id INTO v_conversation;

  INSERT INTO public.conversation_members(conversation_id, user_id, role)
  VALUES (v_conversation, v_owner, 'admin');

  FOREACH v_member IN ARRAY v_members LOOP
    INSERT INTO public.conversation_members(conversation_id, user_id, role)
    VALUES (v_conversation, v_member, 'member');
  END LOOP;
  RETURN v_conversation;
END;
$$;
REVOKE ALL ON FUNCTION public.create_group_chat(text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_group_chat(text, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = p_conversation
      AND ((NOT c.is_group AND (SELECT auth.uid()) IN (c.user_one, c.user_two))
        OR (c.is_group AND EXISTS (
          SELECT 1 FROM public.conversation_members cm
          WHERE cm.conversation_id = c.id AND cm.user_id = (SELECT auth.uid())
        )))
  ) THEN RETURN; END IF;
  INSERT INTO public.conversation_reads(user_id, conversation_id, last_read_at)
  VALUES ((SELECT auth.uid()), p_conversation, now())
  ON CONFLICT (user_id, conversation_id) DO UPDATE SET last_read_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.conversation_unread()
RETURNS TABLE(conversation_id uuid, unread integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT c.id, count(m.id)::int
  FROM public.conversations c
  LEFT JOIN public.conversation_reads r ON r.conversation_id = c.id AND r.user_id = (SELECT auth.uid())
  JOIN public.messages m ON m.conversation_id = c.id
   AND m.sender_id <> (SELECT auth.uid())
   AND m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
  WHERE ((NOT c.is_group AND (SELECT auth.uid()) IN (c.user_one, c.user_two))
    OR (c.is_group AND EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = c.id AND cm.user_id = (SELECT auth.uid())
    )))
  GROUP BY c.id;
$$;

CREATE OR REPLACE FUNCTION private.unread_messages(uid uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT count(*)::integer FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
  LEFT JOIN public.conversation_reads r ON r.conversation_id = c.id AND r.user_id = uid
  WHERE ((NOT c.is_group AND uid IN (c.user_one, c.user_two))
    OR (c.is_group AND EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = c.id AND cm.user_id = uid
    )))
    AND m.sender_id <> uid
    AND m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz);
$$;

-- Trigger/event-trigger routines should never be callable via PostgREST.
REVOKE ALL ON FUNCTION public.remove_follows_on_block() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.server_time() SET search_path = '';
