# Shared jobs and automatic updates

## Using sharing

1. Refresh both devices so they load the updated app.
2. On the device with the job, open **Share / Sync**. Create a code if the job is not already shared.
3. Choose **Copy Job Link**. The link includes the connected job code.
4. The other person opens the link and chooses **Join With Code**. Their existing local job remains available in the job selector.
5. Check that both devices show the same connected code. Saved changes and attendance autosaves normally appear on the other device within a few seconds while the app is open.

A plain website URL does not connect another device to a job. Sharing a job link/code grants the existing view/edit access to that job; it is not a read-only invitation or a user account.

**Synced** means this device matches the shared cloud job. It does not prove another person is online or has read a particular change. The dialog shows the last successful check and has **Sync Now** to request an immediate check.

## What changed

- Reopened shared jobs now start automatic synchronization after app initialization. Previously, startup displayed a shared code without starting the polling loop.
- Active apps check for updates every two seconds. Hidden tabs check less often; returning to the app or reconnecting triggers a fresh check.
- Job-specific links prefill the join code, including when the app is already open. The invitation fragment is consumed so reloading or switching jobs does not reopen an old invitation.
- Joining a new shared code creates a separate job workspace instead of replacing the current local job. Joining a code already on the device opens that existing workspace.
- The app shows connecting, upload pending, uploading, synced, offline, retrying and review-needed states. Failed or timed-out requests release the sync lock and retry. Local records remain available offline.
- A direct REST RPC fallback supports cloud requests if the optional Supabase script does not load. Requests have a ten-second deadline, including SDK requests.
- A compact fingerprint of the last synchronized data is retained per workspace. Canonical comparison tolerates JSON object key reordering without duplicating the full data snapshot in browser storage.
- Each upload first reads the current shared version. If both versions differ from the known baseline, automatic upload pauses for review rather than deliberately overwriting a known intervening edit.
- Review offers **Use Shared Version — Keep Local Backup** or an explicitly confirmed **Publish This Device’s Version**. The version being replaced is retained as a separate unsynced local backup job. If the backup cannot be stored, the replacement does not proceed.
- Incoming data waits while a form, attendance field or mouse selection is being edited. Local changes made during a request are checked again before applying incoming data. Old responses cannot update a different workspace.
- Stop Syncing persists the disconnected state and clears timers. An old global code cannot silently reconnect an explicitly unshared workspace on reload.
- Invalid shared payloads are rejected. Mobile sharing controls wrap appropriately, and Close stays accessible while scrolling.

## Limits of the existing backend

The existing `create_management_job`, `load_management_job` and `save_management_job` RPC contract is retained; no production schema or server functions were changed. These RPCs still save whole job documents. The client preflight detects intervening edits already present when it reads, but the subsequent write is not an atomic version-checked transaction. Two writes that overlap precisely can still race, especially if another browser is running the older app. An atomic server revision/compare-and-swap endpoint is required to guarantee concurrent-write protection. Smaller version checks or incremental updates would also reduce traffic for jobs containing many photos.

On the first run of the upgrade, an older shared workspace without a saved fingerprint can require a one-time version review if its local data differs from the shared data. The app preserves the local version rather than assuming it is safe to overwrite either copy.

Local backups share the browser's storage capacity and are not an external backup service. The role selector does not introduce additional sharing permissions. Do not infer online presence or delivery receipts from the sync badge.

## Validation

All 60 Chromium regression tests pass. Added checks cover startup/reload polling, direct RPC fallback, job links and clipboard copy, joining without replacing another job, persistent disconnect, offline edits and failed-upload recovery, conflict review and both backup choices, editor-safe incoming updates, stale workspace responses, malformed payloads, request deadlines and phone layout.

A test with two isolated browser contexts verifies automatic task updates in both directions and attendance hours reaching the other device's snapshot and labour hours. It uses an in-memory server implementing the same RPC names and parameters. The existing Programme, drag selection, dates, bookings, attendance, costs, diary, material, issue, task and estimating checks also pass.

Run `npm test --prefix tests`. Supabase requests are blocked or handled by the mock; the tests do not read or write production job data. A read-only connectivity probe of the production load endpoint was blocked by this environment's network proxy (403). Live connectivity, the other person's current connection and the site's hosting deployment therefore remain unverified.
