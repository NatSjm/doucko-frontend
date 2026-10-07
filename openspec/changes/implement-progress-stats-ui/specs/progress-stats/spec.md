## ADDED Requirements

### Requirement: Admin stats page

The admin stats page (`/admin/stats`, English) SHALL show, as `getStats`
answers them, the success metric verdict, a weekly table (newest week first:
week start, sessions, qualifying sessions, the answered-task count of each
session, hints used, revealed tasks; the current week and the four metric
weeks marked) and the first-try rate per topic (FR-40). The page SHALL
request 5 weeks by default, so all four metric weeks are shown, and SHALL
offer 5, 8, 12, 26 or 52 weeks. When the metric is not met, every metric week
in the response with fewer than 3 qualifying sessions SHALL be marked as
short. A topic with no resolved task SHALL show "—". When no practice is
recorded the page SHALL show an empty-state message and no error. The page
SHALL be reachable from the admin navigation.

#### Scenario: Metric not met, short week marked

- **GIVEN** the 4 most recent completed weeks have 3, 3, 2 and 3 qualifying sessions
- **WHEN** the admin opens Stats from the admin navigation
- **THEN** the metric shows "Not met", the week with 2 shows 2 qualifying sessions and is marked "Short", and the current week is marked "This week"

#### Scenario: Metric met

- **GIVEN** each of the 4 most recent completed weeks has 3 qualifying sessions and the current week has 0
- **WHEN** the admin opens the stats page
- **THEN** the metric shows "Met" and no week is marked "Short"

#### Scenario: Weekly figures and session sizes

- **GIVEN** a week with sessions of 12, 10 and 11 answered tasks, 7 hints used and 3 revealed tasks
- **WHEN** the admin opens the stats page
- **THEN** that week's row shows 3 sessions, 3 qualifying sessions, "12, 10, 11", 7 and 3

#### Scenario: First-try rate per topic

- **GIVEN** topic "Desetinná čísla" with 6 of 8 resolved tasks correct on the 1st attempt and a topic with no resolved task
- **WHEN** the admin opens the stats page
- **THEN** the first shows "75%" and "6 of 8 first try", the second "—"

#### Scenario: Week count

- **GIVEN** the stats page with the default 5 weeks
- **WHEN** the admin chooses 12 weeks
- **THEN** the API is asked for 12 weeks and the table shows 12 rows

#### Scenario: No data yet

- **GIVEN** no attempts and no opened hints
- **WHEN** the admin opens the stats page
- **THEN** every week shows zeros, the metric shows "Not met", the empty-state message is shown and no error

### Requirement: Admin flag queue

The flag queue (`/admin/reports`, English) SHALL list the reports in the
order `listReports` returns them, each with its status, time, the task
excerpt, a link to the task editor, the reason, the child's note and — with an
attached attempt — the attempt number (replay marked), the hints used, and
per answer part the raw input in full, the checker's verdict and the
re-evaluated verdict with its time (FR-41). Raw input SHALL wrap inside the
entry with no ellipsis and no horizontal page scroll. A status filter SHALL
offer All, Open, Fixed and Dismissed. An OPEN report SHALL offer Dismiss and,
only with an attached attempt, Re-evaluate. After an action the outcome SHALL
be announced and receive focus: fixed with the XP added (and a mission bonus),
fixed on a replay attempt with no XP, or nothing changed with the report still
open; a refusal (409) shows the server's reason and the queue reloads. The
queue SHALL be reachable from the admin navigation.

#### Scenario: Report with an attempt

- **GIVEN** an OPEN report "Answer is correct" whose attempt 2 had raw `0,5` marked `WRONG`
- **WHEN** the admin opens the flag queue from the admin navigation
- **THEN** the entry shows Open, the task excerpt with a link to its editor, the reason, `0,5` and "Wrong", and offers Re-evaluate and Dismiss

#### Scenario: Report without an attempt

- **GIVEN** an OPEN report made before any attempt
- **WHEN** the admin opens the flag queue
- **THEN** the entry says no attempt is attached and offers Dismiss but not Re-evaluate

#### Scenario: Fix the answer spec, then re-evaluate

- **GIVEN** the OPEN report above while the task still expects `0.05`
- **WHEN** the admin re-evaluates, then opens the task from the report, corrects the accepted answer to `0.5`, saves, returns to the queue and re-evaluates again
- **THEN** the first outcome says nothing changed and the report stays Open; the second says the attempt is now correct and +4 XP was added, and the report is Fixed

#### Scenario: Both verdicts on a fixed report

- **GIVEN** a FIXED report whose attempt was `WRONG` and re-evaluated `CORRECT`
- **WHEN** the admin filters the queue by Fixed
- **THEN** only fixed reports are listed and the entry shows "Wrong" and "Correct", each with its own time

#### Scenario: Replay attempt re-evaluated

- **GIVEN** an OPEN report attached to a replay attempt that the current spec accepts
- **WHEN** the admin re-evaluates it
- **THEN** the outcome says the replay attempt is now correct and earns no XP, and the report is Fixed

#### Scenario: Long raw input

- **GIVEN** a report whose raw input has 100 code points
- **WHEN** the admin opens the flag queue at 1280×720
- **THEN** the whole input is shown, wrapped within the entry, with no ellipsis and no horizontal page scroll

#### Scenario: Dismiss

- **GIVEN** an OPEN report
- **WHEN** the admin dismisses it
- **THEN** "Report dismissed." is announced and the entry shows Dismissed with no actions
