Programme timetable and activity resources

Use **Show** above the timetable to switch between Activities & Resources, Programme Activities, Resource Bookings, Labour, Trades or Hire / Plant. Resource views include standalone bookings and resources assigned to activity working dates. Assigned resource rows follow the activity schedule; open their label to edit the activity. Standalone booking bars retain their existing drag behaviour.

In an activity, use **Choose resources** to select saved labour names, trades/companies and hire/plant. Changing category preserves selections in other categories. Existing inactive assignments remain visible when editing. Add **Labour hire / Crew company** using saved company suggestions or enter a company, and **Planned crew size (people)** for the total people needed for this particular activity. The crew count is informational planned headcount for the activity, not a quantity of plant or an additional count on top of selected names. It can represent unnamed labour hire crew.

Company and headcount appear in activity summaries and resource timetable rows and survive editing, reload and shared-job persistence. Named resources continue to feed Site Sign-In as expected on the activity's working days. Company/headcount alone do not create fictitious workers, actual attendance, timesheets or costs. Record actual named attendance and hours separately in Site Sign-In. Previous dates and attendance are unchanged.

Validation covers desktop/phone category selection, cross-category retention, hire assignment, company and headcount persistence, timetable switching, and expected versus actual attendance. Existing Programme drag, resize, bookings, deletion and attendance regressions remain in the full suite: `npm test --prefix tests`.
