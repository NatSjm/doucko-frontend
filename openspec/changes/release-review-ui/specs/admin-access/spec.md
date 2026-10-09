## ADDED Requirements

### Requirement: Admin navigation marks the current page
The admin navigation SHALL mark the link of the screen being shown as the current page, and SHALL NOT mark a "New task" or "New mission" link as current while a saved item is being edited on the same route.

#### Scenario: Editing a saved task
- **WHEN** the admin opens `/admin/tasks/edit?taskId=<id>`
- **THEN** the "New task" link is not marked as the current page

#### Scenario: Creating a mission
- **WHEN** the admin opens `/admin/missions/edit` without a mission id
- **THEN** the "New mission" link is marked as the current page

### Requirement: Malformed CSRF cookie does not break admin requests
The admin client SHALL send an `XSRF-TOKEN` cookie value that is not percent-decodable unchanged, so the server refuses it, instead of throwing in the browser.

#### Scenario: Cookie with a broken escape
- **WHEN** the cookie is `XSRF-TOKEN=bad%E0%A4%A` and the admin signs out
- **THEN** the request is sent with `X-XSRF-TOKEN: bad%E0%A4%A`
