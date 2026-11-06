/* =====================================================================
   JLR TRACKER - office mailbox -> tracker (runs every minute in Google Apps Script)   v2 (Nov 2026)
   A. Client mail: sends attachments from client emails to the tracker. The tracker decides who is
      a client; mail from anyone else is only labelled "JLR/Not a client" and nothing is stored.
      To retry such a mail (after saving that email on the client), remove the label in Gmail.
   B. Notice watch: emails from the GST, Income-tax, TRACES and MCA portals (and client emails that
      forward a notice) are read and added to Notices. Managers and Partners get an email for each
      new notice, and a summary every morning (8 AM) and night (8 PM). "Check now" on the Notices
      page makes this script check within a minute.

   Setup (once, signed in to the office Gmail):
   1. script.google.com -> open "JLR mail intake" (or New project) -> replace the code with this file -> Save
   2. Project Settings (gear) -> Script properties:
        INTAKE_KEY = <key from Tracker: Settings -> Client mail>
        NOTICE_KEY = <key from Tracker: Settings -> Notice watch -> Make key>
   3. Run "setup" once and allow the Gmail + send-email permissions it asks for.
   ===================================================================== */
var SUPABASE = 'https://heibxdeurtgihmfritiq.supabase.co';
var ANON = 'sb_publishable_yZoUFE9Yus1HFiFpQRpxng_ngnlu-It';   // public key (same as the website)
var FUNCTION_URL = SUPABASE + '/functions/v1/mail-intake';
var LOOK_BACK = 'newer_than:2d';                  // first run also catches the last 2 days
var MAX_BYTES = 20 * 1024 * 1024;                 // larger files are skipped (Gmail limit is 25 MB)
var NOTICE_QUERY = '(from:gst.gov.in OR from:gstn.org.in OR from:incometax.gov.in OR from:insight.gov.in OR from:tdscpc.gov.in OR from:mca.gov.in' +
                   ' OR subject:notice OR "show cause" OR "notice u/s" OR "DRC-01" OR "ASMT-10") -in:sent -in:drafts -in:trash -in:spam newer_than:3d';
var SITE = 'https://vijayaraghavannvaradharajan-lab.github.io/jlr-compliance/';

function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('everyMinute').timeBased().everyMinutes(1).create();
  everyMinute();
}

function everyMinute() {
  var lock = LockService.getScriptLock(); if (!lock.tryLock(5000)) return;
  try {
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty('INTAKE_KEY')) { try { checkMail_(); } catch (e) { console.error('Client mail: ' + e); } }
    if (props.getProperty('NOTICE_KEY')) { try { noticeWatch_(); } catch (e) { console.error('Notice watch: ' + e); } }
  } finally { lock.releaseLock(); }
}
function checkMail() { everyMinute(); }                  // old trigger name still works

/* ---------------- A. client mail (unchanged) ---------------- */
function checkMail_() {
  var props = PropertiesService.getScriptProperties(), key = props.getProperty('INTAKE_KEY');
  var seen = JSON.parse(props.getProperty('SEEN') || '[]');
  var done = label_('JLR/Imported'), skip = label_('JLR/Not a client');
  var threads = GmailApp.search('has:attachment -in:sent -in:drafts -in:trash -in:spam -label:"JLR/Not a client" ' + LOOK_BACK, 0, 30);
  threads.forEach(function (th) {
    th.getMessages().forEach(function (m) {
      var id = m.getId();
      if (seen.indexOf(id) >= 0 || m.isDraft()) return;
      var atts = m.getAttachments({ includeInlineImages: false, includeAttachments: true });
      var result = 'none', ok = true;
      atts.forEach(function (a) {
        if (!ok || a.getSize() > MAX_BYTES) return;
        var payload = { id: id, from: m.getFrom(), subject: m.getSubject(), date: m.getDate().toISOString(),
          snippet: m.getPlainBody().slice(0, 400), file: { name: a.getName(), mime: a.getContentType(), data: Utilities.base64Encode(a.getBytes()) } };
        var r = UrlFetchApp.fetch(FUNCTION_URL, { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload),
          headers: { 'x-intake-key': key }, muteHttpExceptions: true });
        if (r.getResponseCode() >= 300) { ok = false; console.error(r.getResponseCode() + ' ' + r.getContentText()); return; }
        var out = JSON.parse(r.getContentText() || '{}');
        if (out.result === 'stored' || out.result === 'duplicate') result = 'stored';
        else if (result === 'none') result = out.result;          // not_client / filtered / disabled
      });
      if (!ok || result === 'disabled') return;                    // try again next minute
      if (result === 'not_client') { th.addLabel(skip); return; }    // remove the label to try again (e.g. after saving the client's email)
      if (result === 'stored') th.addLabel(done);
      seen.push(id);
    });
  });
  props.setProperty('SEEN', JSON.stringify(seen.slice(-400)));
}

/* ---------------- B. notice watch ---------------- */
function rpc_(fn, body) {
  var r = UrlFetchApp.fetch(SUPABASE + '/rest/v1/rpc/' + fn, { method: 'post', contentType: 'application/json', payload: JSON.stringify(body),
    headers: { apikey: ANON, Authorization: 'Bearer ' + ANON }, muteHttpExceptions: true });
  if (r.getResponseCode() >= 300) throw new Error(fn + ' ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 300));
  var t = r.getContentText(); return t ? JSON.parse(t) : null;
}

function noticeWatch_() {
  var props = PropertiesService.getScriptProperties(), key = props.getProperty('NOTICE_KEY');
  var now = new Date(), hh = +Utilities.formatDate(now, 'Asia/Kolkata', 'H'), day = Utilities.formatDate(now, 'Asia/Kolkata', 'yyyy-MM-dd');
  var slot = hh >= 20 ? day + ' night' : hh >= 8 ? day + ' morning' : '';
  var digestDue = slot && props.getProperty('DIGEST_LAST') !== slot;
  var poll = rpc_('notice_poll', { p_key: key });
  if (!poll || !poll.enabled) return;
  if (!poll.run && !digestDue) return;                     // nothing asked; next scheduled check later

  var found = 0, err = null;
  try { found = scanNotices_(key); } catch (e) { err = String(e).slice(0, 300); }
  rpc_('notice_checked', { p_key: key, p_found: found, p_error: err });

  if (digestDue) { sendDigest_(key, slot.indexOf('night') > 0 ? 'Night' : 'Morning'); props.setProperty('DIGEST_LAST', slot); }
}

function scanNotices_(key) {
  var props = PropertiesService.getScriptProperties();
  var seen = JSON.parse(props.getProperty('SEEN_N') || '[]'), lbl = label_('JLR/Notice'), made = 0;
  GmailApp.search(NOTICE_QUERY, 0, 40).forEach(function (th) {
    th.getMessages().forEach(function (m) {
      var id = m.getId();
      if (seen.indexOf(id) >= 0 || m.isDraft()) return;
      var out = rpc_('notice_intake', { p_key: key, p_mail: { id: id, from: m.getFrom(), subject: m.getSubject(), date: m.getDate().toISOString(),
                                                                body: m.getPlainBody().slice(0, 20000) } });
      if (!out || out.result === 'disabled') return;
      seen.push(id);
      if (out.result === 'created' || out.result === 'unmatched') {
        th.addLabel(lbl); made++;
        if (out.alert_email && out.emails && out.emails.length) alertMail_(out, m);
      }
    });
  });
  props.setProperty('SEEN_N', JSON.stringify(seen.slice(-600)));
  return made;
}

function fmtDate_(d) { return d ? Utilities.formatDate(new Date(d + 'T00:00:00+05:30'), 'Asia/Kolkata', 'dd MMM yyyy') : 'not stated'; }

function alertMail_(out, m) {
  var dept = out.dept === 'ROC/MCA' ? 'MCA' : out.dept, who = out.client || 'a sender not yet matched to a client';
  var subj = (out.result === 'created' ? 'New ' + dept + ' notice: ' : 'Notice email needs a client: ') + who + ' – ' + out.notice_type;
  var body = (out.result === 'created'
      ? 'A new ' + dept + ' notice was added to the tracker.\n\nClient: ' + who + '\nNotice: ' + out.notice_type + (out.ref_no ? '\nReference: ' + out.ref_no : '') +
        '\nReply due: ' + fmtDate_(out.reply_due) + '\n'
      : 'A notice email arrived but the tracker could not tell which client it is for.\nOpen Notices -> "From email – needs a client" to choose the client.\n') +
    '\nEmail: ' + m.getSubject() + '\nFrom: ' + m.getFrom() + '\n\nOpen the tracker: ' + SITE + '#/notices\n\n— JLR Compliance Tracker';
  MailApp.sendEmail({ to: out.emails.join(','), subject: subj, body: body, name: 'JLR Compliance Tracker' });
}

function sendDigest_(key, when) {
  var d = rpc_('notice_digest', { p_key: key });
  if (!d || !d.emails || !d.emails.length) return;
  if (!d.new.length && !d.due.length && !d.unmatched) return;          // nothing to say
  var L = [when + ' notice summary – ' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy'), ''];
  if (d.new.length) { L.push('New notices (last 12 hours): ' + d.new.length);
    d.new.forEach(function (n) { L.push('  • ' + n.client + ' – ' + n.dept + ' ' + n.type + (n.ref ? ' (' + n.ref + ')' : '') + ', reply by ' + fmtDate_(n.due)); }); L.push(''); }
  if (d.due.length) { L.push('Replies due in the next 7 days or late: ' + d.due.length);
    d.due.forEach(function (n) { L.push('  • ' + (n.late ? 'LATE ' : '') + fmtDate_(n.due) + ' – ' + n.client + ' – ' + n.dept + ' ' + n.type + (n.staff ? ' – ' + n.staff : '')); }); L.push(''); }
  if (d.unmatched) L.push(d.unmatched + ' notice email(s) still need a client (Notices -> From email).', '');
  L.push('Open the tracker: ' + SITE + '#/notices', '', '— JLR Compliance Tracker');
  MailApp.sendEmail({ to: d.emails.join(','), subject: when + ' notice summary: ' + d.new.length + ' new, ' + d.due.length + ' due soon', body: L.join('\n'), name: 'JLR Compliance Tracker' });
}

function label_(name) { return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name); }
