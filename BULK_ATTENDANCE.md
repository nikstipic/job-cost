# Daily Site Sign-In

1. Open the required date and review expected people.
2. Press **Mark All On Site**, confirm the date/count, and mark any exceptions absent/off site. You can also mark people on site individually.
3. Enter standard hours and press the green **Apply Nh to N on site** button.
4. Edit individual hours for early finishes/overtime and press **Save Day**.

There are no selection buttons, selection checkboxes, crew selectors or name dropdown. **Find a person / trade** only filters names, roles and crews; it never changes who receives hours. Bulk hours always use everyone marked on site for the chosen day, including hidden search results and manually added people. Expected-only, off-site and absent people receive no hours from this action. With no one on site, Apply is disabled. Individual attendance, hours and secondary details remain editable.

**Keep entered hours & absent records** is checked by default. Positive actual hours remain protected, while on-site people with zero hours can receive their daily hours. The help text shows how many existing records are kept. Unchecking protection warns before replacing entered hours. Applying zero hours marks the affected on-site people absent. Other dates and planned hours remain unchanged.

**Mark All On Site** affects everyone listed for that day, including manual people and hidden rows. It warns before replacing absent statuses and leaves hours unchanged. **Clear On-Site Marks** removes all on-site marks but keeps actual hours and absent statuses; it confirms when hours have already been entered. Neither action changes another date.

Compact green **+ Person / Trade** and **+ Manual** buttons sit beside search on desktop and directly below it on phones. Manual entries support inclusive start/end dates and optional Programme scheduling. Expected future days start with no attendance and zero actual hours; planned crew quantities do not create fictitious attendees.

Attendance uses the existing dated snapshots and whole-day autosave/Save Day path. Updates continue to feed diary attendance, hours summaries, labour costs and shared-job persistence. Existing manual timesheets keep their prior precedence. Standard daily hours are remembered per job and never automatically applied on another date.

Desktop attendance uses a fixed-width table with proportional columns so all fields fit available page width. Phones retain compact stacked cards, expandable details and the fixed Save Day button.

Regression checks cover large crews, exceptions, overwrite confirmation/cancellation, filtered/manual attendees, absent and expected-only exclusion, history, reload, job defaults, Programme integration and mocked sharing. Layout checks cover the desktop table at 800/1024/1440px and phone attendance at 360/390/430px. Run `npm test --prefix tests`. No production data is written by these tests.
