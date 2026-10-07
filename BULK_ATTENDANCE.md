# Bulk Site Sign-In

## Daily workflow

1. Open the required Site Sign-In date and review the expected Labour/Trades count.
2. Enter the normal daily hours, then press **Mark N Expected Present — Nh**.
3. Adjust exceptions by searching for a name or scrolling the compact attendance list. Actual hours, attendance, work area, activity and other existing details remain editable.
4. Press **Save Day**. Feedback shows present people, explicitly absent people and total actual hours.

Alternatively, use **Select All**, individual selection checkboxes, or **Select group**, then **Apply to N selected**. Group names come from that day's roles and crews; repeated names are deduplicated. Selecting a group replaces the current selection. Select All includes every entry for the date, including entries hidden by attendance search. The displayed selected count includes those hidden entries.

## Safeguards

**Keep existing attendance & hours** is checked by default. Bulk actions skip rows already marked present/absent or containing positive actual hours. The feedback states how many existing records were kept. To deliberately replace them, uncheck that protection; a confirmation identifies the affected date, existing-record count and sample names/hours. Cancelling leaves the records and remembered standard hours unchanged.

The expected quick action includes only Labour/Trades expected from Programme/resource bookings for the selected date. Hire/plant, unscheduled directory people and manually added unexpected people are excluded. They can still be selected explicitly for the selected-hours action. Each existing attendance row represents its existing worker/trade entry; this does not invent individual workers within a subcontractor company.

Bulk changes set actual hours and attendance together: positive hours mark present; zero marks absent. They do not change planned hours, Programme dates or another day's history. Marking an individual absent clears actual hours, with confirmation when positive hours are already recorded. Entering positive actual hours for an absent person changes that person back to present.

The last successfully applied bulk hours are remembered in the job's workspace data, defaulting to eight hours for a new job. Opening another date does not apply them or mark scheduled people present. Selection is temporary UI state and is not saved into attendance history.

## Persistence and integration

Bulk edits use the existing dated Site Sign-In snapshot and whole-day save path. One Apply schedules one autosave for the entire snapshot, rather than one save per worker. Save Day explicitly saves the complete day; existing autosave remains as protection against losing adjustments. Existing diary attendance, hours breakdown, labour costs and related views refresh through the established attendance save path. Existing manually entered labour timesheets retain their prior precedence over snapshot-derived entries for the same date.

Mobile rows keep name, selection, status, actual hours and arrival/absence actions visible. Secondary details expand on demand. Save Day remains above the bottom navigation while scrolling. Desktop retains its attendance table with separate selection and arrival checkboxes. Removal re-renders remaining rows so their selection/edit handlers keep the correct indexes.

## Validation

Automated tests cover a 40-worker crew plus scheduled trade and plant, bulk filling, individual early departure/absence/overtime exceptions, original-date history, snapshot-derived labour hours, persistence/reload, group selection, selection hidden by search, default protection, cancelled/confirmed overwrite, temporary selection exclusion from stored data, job-specific defaults, unrecorded future expectations, unexpected-person exclusion, correcting absence, and phone interactions at 360/390/430px.

All 40 regression tests pass, with the seven bulk attendance checks rerun after the final default/protection adjustment. The complete regression suite also retains Programme dragging/date clicks, booking/Remove Future/Delete, labour/trade/hire scheduling, costs, diary, issues, tasks, materials, estimating, workspace isolation and mocked cloud recovery checks. Run `npm test --prefix tests`.

Screenshots were inspected using a 40-worker fixture. Layout measurements found no page-width overflow at 360/390/430/1440px. Chromium phone emulation is used; physical-device keyboards and production multi-device synchronization were not tested. No production data is written by the tests, and these repository changes have not been deployed.
