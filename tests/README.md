# Browser regression tests

The app remains a standalone HTML file. Test dependencies are isolated here.

```sh
npm ci --prefix tests
npm test --prefix tests
```

The runner uses `/usr/bin/chromium` or `/usr/bin/google-chrome` when available. Set
`CHROMIUM_PATH` to use another installed Chromium executable. Otherwise install
Playwright's browser from this directory with `npx playwright install chromium`.

Tests start their own local HTTP server and use isolated browser storage. They
never contact the production Supabase database: the CDN request is deliberately
blocked to also verify that local functionality survives an unavailable cloud
client. Desktop tests use actual mouse pointer dragging; mobile tests use a touch
viewport. Both run in the Australia/Sydney timezone.

The suite covers persistence and legacy data, navigation, activities, resource
ranges, labour/trade/hire schedules, popup actions, attendance and actual hours,
workspace isolation, live costs and diary updates, tasks, issues, materials,
estimating, deletion/reindexing, working-day duration and daylight-saving dates.
