/* =====================================================================
   JLR TRACKER - office mailbox -> tracker (runs every minute in Google Apps Script)
   Sends attachments from client emails to the tracker. The tracker decides who is a client;
   mail from anyone else is only labelled "JLR/Not a client" and nothing is stored.
   To retry such a mail (after saving that email on the client), remove the label in Gmail.

   Setup (once, signed in to the office Gmail):
   1. script.google.com -> New project -> paste this file -> Save (name: JLR mail intake)
   2. Project Settings (gear) -> Script properties -> Add:  INTAKE_KEY = <key from Tracker: Settings -> Client mail>
   3. Run "setup" once and allow the Gmail permission it asks for.
   ===================================================================== */
var FUNCTION_URL = 'https://heibxdeurtgihmfritiq.supabase.co/functions/v1/mail-intake';
var LOOK_BACK = 'newer_than:2d';                  // first run also catches the last 2 days
var MAX_BYTES = 20 * 1024 * 1024;                 // larger files are skipped (Gmail limit is 25 MB)

function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('checkMail').timeBased().everyMinutes(1).create();
  checkMail();
}

function checkMail() {
  var key = PropertiesService.getScriptProperties().getProperty('INTAKE_KEY');
  if (!key) throw new Error('Add INTAKE_KEY in Project Settings -> Script properties');
  var lock = LockService.getScriptLock(); if (!lock.tryLock(5000)) return;
  try {
    var props = PropertiesService.getScriptProperties();
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
  } finally { lock.releaseLock(); }
}

function label_(name) { return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name); }
