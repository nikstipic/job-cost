# Usability review — 7 October 2026

The existing construction-focused design, navigation, pages, timetable, cards and tables are retained. The changes concentrate on daily site work and shared form behaviour.

## Findings, changes and workflow benefit

| Finding | Change | Benefit |
| --- | --- | --- |
| Long forms put Save below the phone screen. | Shared dialog opening helper, scrollable fields and visible Cancel/Save footer; viewport height follows the visible browser area. | Users can save without scrolling past every field. Save appears consistently after Cancel. |
| Saving often gave little feedback. | Short, nonblocking feedback for saves, completion, moves and attendance; browser storage failures display an error instead of success. | Users can tell whether an action succeeded. Attendance also shows its autosave state. |
| Programme dates and dragging lacked guidance. Multi-day resource bars looked disconnected. | Concise interaction guidance, date hover/focus, drag destination feedback and joined resource segments. | The existing timetable is easier to interpret and operate. Activities and resources keep their separate roles. |
| Programme Day rows had crowded destructive actions; attendance and diary required navigation away. | Edit remains visible; Delete and Remove Future move under More with explanations and existing confirmations. Previous/Today/Next and same-date Sign-In/Diary shortcuts are added. Assigned activity workers are shown; inspections and important events have distinct groups. | The popup becomes a clearer daily overview with faster movement to actual site records. |
| Attendance mixed expected and arrived people, used a numbered desktop prompt, and had no explicit absence state. | Expected/On site/Absent labels; arrival and absence controls; search by name/trade/crew; shared searchable person picker; named manual-person form. Alphabetical ordering stays intact. | Faster daily attendance and unexpected arrivals. Marking arrival does not invent actual hours; new people start at zero actual hours. Filtering does not discard hidden people. |
| Mobile attendance showed many editable details at once. | Arrival and actual hours stay prominent; secondary details expand on demand. | Less clutter while retaining editable names, role, crew and planned hours. |
| Diary fields were long and programme suggestions risked implying work had happened. | Common end-of-day fields come first; additional notes and references are grouped. Programme activities can be explicitly added to the completed-work draft. Existing draft text and linked attendance remain editable; planned deliveries are not automatically recorded as received. | Less scrolling and repeated typing without creating inaccurate site history. |
| Completed material orders obscured incoming deliveries. | Default Outstanding filter, Due soon/Completed/All, supplier/material/area search, due/overdue badges and useful empty states. | Users can find outstanding deliveries quickly; all orders, payments and original edit indexes remain available. |
| Open issues lacked quick text search. | Search by issue, owner, area or type; Overdue filter; useful empty states; responsibility suggestions; Delete under More. | Easier triage while preserving updates, evidence and closure history. |
| Management tasks did not show responsibility or priority. | Optional responsible person and priority fields, priority ordering and visible owner/urgent badges; useful empty state. | The daily list communicates who should do the work and which tasks need attention. Ongoing tasks retain their existing completion behaviour. |
| Quote correspondence made the main quote form dense. | RFQ/email/attachment fields grouped in an optional expandable section. | Company, amount, scope and exclusions stay easy to reach; correspondence and evidence remain available. |

## Mobile and desktop

Phone improvements include larger touch targets in the changed workflows, compact date navigation with a visible Today action, expandable attendance details, two-column popup actions, a reachable modal Close control, and fixed form action footers. Existing bottom navigation and mobile Programme agenda remain in place. Layout changes respond when resizing between desktop and mobile.

Desktop retains efficient tables and timetable views. Searchable attendance replaces the numbered prompt; row actions are less crowded; forms scroll within the dialog while keeping their actions visible. No desktop table has been converted into a large phone-style card layout.

## Deliberately unchanged

Financial calculations, budgets, quote award rules, payments, claims, labour/trade/hire accounting, scheduling links and existing record relationships remain as they were. Pricing totals and category separation were already clearly presented, so the main estimating layout stays intact. Overview and Progress retain their existing summaries. Navigation, terminology, job selection, colours, authentication and the cloud backend were not redesigned. Existing destructive confirmations remain in effect.

Attendance saves retain the targeted refresh path from the prior stability work, rather than adding full-app rerenders for each hour edit. Viewport listeners are registered once; attendance search only filters existing rows/cards. No broad performance rewrite or unmeasured speed claim is made.

## Larger improvements recommended, not implemented

- Server-side version/conflict handling for simultaneous cloud edits, with recovery history. This requires a backend contract change.
- Explicit directory person IDs throughout scheduling and attendance, replacing remaining legacy name/index references. This needs careful data migration.
- An optional reviewed end-of-day summary that combines issue resolutions, deliveries, inspections and photos. It needs rules distinguishing plans from verified events before it can safely write diary records.
- Physical-device checks for iPhone Safari and Android keyboards, camera uploads and safe-area behaviour. Browser emulation cannot establish those behaviours.

## Validation

The browser audit traversed 20 pages, the Programme Day popup and nine generic forms at desktop 1440px and phone 390px/360px: 90 layout observations, with screenshots inspected for attendance, materials and the popup. No page-width overflow was found in those observations; the timetable retains its intentional internal horizontal scrolling. In the 390px diary audit, Save moved from below the screen (approximately 1827px) to 871px within a 900px viewport.

All 33 automated Chromium regression tests pass. The suite checks document integrity, navigation, workspace isolation, legacy data/reload, Programme activity and multi-day resource editing, actual pointer dragging, date clicks, working-day duration, daylight-saving shifts, popup Edit/Delete/Remove Future, labour/trade/hire schedules, cost and attendance propagation, diary operations, issue/task operations, material delivery/collection links, estimating quote award, person deletion/reindexing, and mocked cloud recovery.

Added checks exercise searchable attendance, absence, unexpected-person creation, preservation of filtered rows and zero actual hours, material filter edit indexes, task responsibility/priority persistence, explicit diary suggestions, storage failure feedback, and diary Save visibility at 360px/390px/430px with both 844px and 500px heights. The short viewport simulates available keyboard space; it is not a physical keyboard test.

Run `npm test --prefix tests`. Tests use isolated browser storage and block the external Supabase CDN. Cloud recovery is mocked; no production data is written. Live multi-device sync and physical-device behaviour are not claimed as tested. These are repository changes, not a production deployment.
