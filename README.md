# StudyLog API

A small REST API for logging study sessions, plus an automated Postman test suite.
Built for the "Growing a Competency" assignment (competency: API testing with Postman/Newman).

## Run

```bash
npm install
npm start        # API on http://localhost:4000
npm test         # in a second terminal: runs the Postman collection with Newman
```

To use the Postman app instead, import `postman/StudyLog.postman_collection.json` and
`postman/StudyLog-Local.postman_environment.json`, select the "StudyLog Local" environment,
and run the collection from the Collection Runner.

## Endpoints

All `/api` routes need an `X-API-Key` header (default `local-dev-key`, override with `STUDYLOG_API_KEY`).

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /health | Public health check |
| GET | /api/sessions?subject= | List sessions, optional case-insensitive subject filter |
| POST | /api/sessions | Create a session `{ subject, minutes, date, notes? }` |
| GET | /api/sessions/:id | Fetch one session |
| PATCH | /api/sessions/:id | Update some fields |
| DELETE | /api/sessions/:id | Delete a session |
| GET | /api/stats | Totals per subject and top subject |

## What the tests cover

21 requests and 79 assertions in four folders:

1. **Health and authentication**: public health check, missing and wrong API key return 401.
2. **Session lifecycle**: create, read, update, filter, stats, with the new id chained between
   requests through collection variables. The create response is checked against a JSON schema,
   and the stats endpoint is cross-checked against the list endpoint with `pm.sendRequest`.
3. **Validation (negative tests)**: missing fields, wrong types, boundary values (600 passes,
   601 fails), impossible dates, malformed JSON, unknown PATCH fields, unknown ids.
4. **Cleanup**: deletes everything the run created, so the suite can be run again.

A collection-level script also checks every response for speed (< 500 ms) and a JSON content type.

`npm test` also writes an HTML report to `reports/report.html`. Screenshots of the runs are in `screenshots/`.

`reports/broken-server-run.txt` shows the suite run against a copy of the server with the minutes
validation broken on purpose: it fails 4 assertions and points at the exact requests.
