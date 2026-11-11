-- Voices of Great Women: let the new collection's feedback and class-code turns through.
-- Only widens two existing checks; no data is changed.
alter table public.vah_feedback drop constraint if exists vah_feedback_app_check;
alter table public.vah_feedback add constraint vah_feedback_app_check
  check (app in ('republic', 'philosophers', 'inventors', 'explorers', 'women'));

alter table public.vah_group_turns drop constraint if exists vah_group_turns_app_check;
alter table public.vah_group_turns add constraint vah_group_turns_app_check
  check (app in ('republic', 'philosophers', 'inventors', 'explorers', 'women'));
