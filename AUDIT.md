# Stability and integration audit

The application remains a standalone HTML file. This audit preserves its pages,
workflows and browser storage. No user database was reset and no live Supabase
records were written during validation.

## State and integration map

Each `managementWorkspaces.items[id]` owns a `data` object; `db` points to the
active job. `managementWorkspaces` is the authoritative local workspace store;
`mmdb` remains a backwards-compatible local mirror.

| Records | Relationships |
| --- | --- |
| `programmeActivities` | Planned date range, working weekdays/exclusions, actual start/finish, progress, dependencies and assigned labour/trade IDs. Separate from resource bookings. |
| `bookings` | Resource dates/ranges and status; `autoKey` links labour plans and `parentAutoKey` links trade/hire schedules. Materials generate delivery bookings. |
| `labour` | Worker details, `planned` schedule and actual `entries`; Site Sign-In hours supplement actual labour history without replacing direct timesheets. |
| `trades`, `hire` | Resource details, schedules, payments and commercial values. |
| `siteSnapshots` | Date-specific expected attendance plus separately entered attendance, planned hours and actual hours. |
| `daily` | Site Diary review; references Programme, deliveries, inspections/events, actual attendance and linked issues. |
| `issues`, `tasks` | Independent issue/action histories and management tasks, reflected in dependent views. |
| `materials`, `stock` | Delivery/collection orders and on-hand stock; order costs feed commercial views. |
| `estimates`, `estimateGeneralMaterials`, `pricingExtras` | Pre-award pricing, quotes and budgets; awarding a quote creates a Trade. |
| `costs`, `claims` | Other commercial costs and progress claims; cost views also aggregate bookings, labour, trades, hire and materials. |

Mutation handlers call `persist()` to save and refresh connected views.
`refreshViews()` runs the common renderer dispatcher and reports individual
failures without abandoning subsequent pages. Attendance saves use the same
dispatcher for their dependent views without rebuilding the input being edited.
`syncLabourPlans()` keeps keyed labour plans aligned with booking changes.

## Findings and changes

| Bug / root cause | Change |
| --- | --- |
| A full newer page was pasted inside an unfinished CSS string. Its JavaScript and mobile controls were inert; the older page later in the file ran instead. | Reconstructed one valid document, retaining the complete styling and newer UI/handlers. Removed the older duplicate page and its repeated definitions. Restored the unfinished navigation icon rule. |
| The embedded newer booking form had unescaped quotes in its generated `onchange` handler. Apostrophes in resource names also broke generated drag handlers. | Corrected the form handler quoting and encoded apostrophes in resource keys. |
| Startup version cleanup deleted `mmdb` before reading legacy records; integrity cleanup filtered existing historical bookings. | Removed destructive startup cleanup. Initialize missing collections while preserving existing records and unknown fields. Restrict automatic backfill to supported resource/delivery records. |
| Moving, editing or deleting a booking updated `bookings` but left `labour.planned` unchanged. | Synchronize linked labour plans, including ranges, after those operations. Generic labour booking creation also populates the linked schedule. |
| Attendance merging only added expected people, retaining obsolete planned rows after a move or removal. Refreshing was restricted to the visible sign-in page. | Reconcile expectations before dependent rendering, remove obsolete unworked automatic rows, and preserve entered attendance/actual hours and manually entered planned hours. |
| Popup Remove Future affected only the individual row, leaving other future dates for the same resource. | Trim/remove all related future scheduled bookings from the selected date, update labour plans and the open popup, and retain completed work and history. |
| Owner-based resource dragging refused to move future work if that owner had any completed booking. | Move scheduled dates together and leave completed bookings unchanged. |
| Pointer release treated taps as moves; weekday activity moves could change the number of working days. | Use the movement threshold, open the day popup for taps, suppress post-drag clicks, and preserve working-day duration during activity moves. |
| Some booking Edit controls opened the older generic form without range fields. | Route booking edits through the existing dedicated range-aware form, with date validation. |
| Generic detail edits rebuilt records from form fields, dropping plans/history and other fields. | Merge edits into existing records; preserve activity and snapshot metadata too. |
| Switching jobs retained the previous job's attendance DOM/date and pending saves. | Flush the outgoing job, clear its runtime attendance/sync session, then load the incoming job's snapshot. |
| Sign-in saves did not refresh labour costs or update stored diary hour totals. Cost rows ignored actual hours supplied by Site Sign-In. | Refresh dependent commercial/diary views immediately, update diary totals, and include actual site hours in labour costs while preserving direct timesheets. |
| Removing future assignments removed worker IDs from the whole activity, including historical dates. | Retain the assignment with a per-worker cutoff date; historical attendance remains intact. |
| Person deletion left older diary index IDs stale and could remove a different resource with the same displayed name. | Delete explicit linked attendance, reindex remaining activity/snapshot/diary references and cutoffs, and preserve unrelated same-name resources. |
| A secondary renderer exception aborted all subsequent page refreshes. | Isolate renderer failures and show a visible diagnostic; preserve data and continue rendering other pages. |
| Cloud polling only announced incoming data instead of applying it. Rejected save requests could leave `cloudBusy` stuck. | Apply incoming updates only when local data is unchanged, preserve edits made during requests, scope responses to the originating workspace/code, and release busy state in `finally`. Verify with mock RPCs. |

## Duplicate/dead code

Removed the embedded duplicate document and the older document's repeated
application code: the original contained 388 repeated function names across the
two copies. The duplicate was not running twice; it was trapped in the stylesheet.
Retained newer mobile Programme, attendance and worker-picker behavior and merged
legacy worker-label support. Removed destructive cleanup and unsupported automatic
backfill paths. The resulting document has one application script and no duplicate
function declarations or static element IDs.

## Verification

Final result: **25 passed, 0 failed, 0 skipped**. `git diff --check` passed.

Run `npm ci --prefix tests` and `npm test --prefix tests`.

The browser suite exercises desktop and mobile Chromium with isolated storage,
using Australia/Sydney dates. Coverage includes:

- Legacy data, startup, navigation, role/workspace behavior and unavailable cloud client.
- Activity create/edit/save/reload, worker expectations, duration and working-day moves.
- Resource create/edit/save/reload, multi-day ranges and invalid date rejection.
- Actual desktop pointer dragging and clickable timetable dates.
- Programme Day popup Edit, Delete and Remove Future against sorted rows.
- Labour, trade and hire scheduling, completion and connected commercial views.
- Expected versus actual attendance, actual hours, alphabetical names, historical retention and live updates.
- Mobile touch navigation, Programme popup and attendance-hour editing/reload; page overflow check.
- Tasks, issues and Site Diary create/edit/complete/delete/persistence.
- Materials delivery scheduling, date edits, collection and costs.
- Estimating quote award into Trades and costs.
- Workspace isolation, person deletion/reindexing, same-name resources and Sydney daylight-saving arithmetic.
- A controlled secondary-render failure and cloud failure/update paths through mocked RPC responses.

All normal workflows assert there are no uncaught JavaScript or render errors.
The optional-render test deliberately injects a failure to verify isolation.
Tests never reload the app as a substitute for live UI updates; reloads check
persistence separately.

## Remaining limits

- Real multi-device Supabase synchronization was not exercised. The environment's
  Chromium rejects the CDN certificate (`ERR_CERT_AUTHORITY_INVALID`); curl can
  validate the CDN connection. TLS verification was not disabled. Cloud paths are
  tested using mocks, not against production records.
- Supabase's existing RPC contract exposes no revision/compare-and-swap token.
  Simultaneous edits on different devices still need server-side conflict handling;
  this patch does not redesign the backend or claim to solve distributed conflicts.
- Validation uses Chromium desktop and a simulated touch viewport. Physical phone
  behavior and Safari/Firefox were not tested.
- The app's construction holiday/RDO table still covers 2026. Future-year policy
  requires authoritative calendar data, which was not invented during this audit.
- Browser storage remains the documented local persistence mechanism; it is not a
  production backup or authentication system.
