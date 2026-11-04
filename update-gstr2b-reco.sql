-- =====================================================================
--  JLR TRACKER - update: GSTR-2B reconciliation decisions & supplier follow-ups
--  Needs update-gst-review.sql. Safe to re-run.
-- =====================================================================
-- reco = { dec: { "<GSTIN>|<invoice>": { a: action, note, by, at } },
--          fu:  { "<GSTIN>": { at, by, n } } }
-- Not part of the data check in gst_months_before(), so recording a decision
-- does not move a verified month back to Draft.
alter table public.gst_months add column if not exists reco jsonb;

select 'GSTR-2B reconciliation ready' as result;
