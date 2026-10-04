# admin-access Specification

## Purpose
How the frontend implements the store spec `admin-access`: the English sign-in screen in front of
every admin page, the return to it after any admin 401, and the CSRF header on admin mutations.

## Requirements

### Requirement: Admin sign-in screen

The `/admin` route SHALL show an English sign-in form with a single password
field whenever the backend reports no admin session, both on first load and
after any later admin request answered 401 (store spec admin-access, NFR-1,
NFR-15). The form SHALL post `{"password": …}` as JSON to
`POST /api/admin/session`, and SHALL show the admin area only after a 204.

#### Scenario: No session

- **GIVEN** `GET /api/admin/session` answers 401
- **WHEN** `/admin` is opened
- **THEN** the heading "Admin sign-in" and exactly one password field are shown, in an English (`lang="en"`) subtree

#### Scenario: Wrong password

- **WHEN** the admin submits a password and sign-in answers 401
- **THEN** "That password is not correct." is announced as an alert and the form stays

#### Scenario: Session ends while signed in

- **GIVEN** the admin area is shown
- **WHEN** an admin request answers 401
- **THEN** the sign-in form replaces the admin area

### Requirement: CSRF header on admin mutations

Every data-changing request the admin client sends SHALL carry the
`XSRF-TOKEN` cookie value in the `X-XSRF-TOKEN` header (NFR-15). Reads SHALL
NOT carry it.

#### Scenario: Sign-out

- **GIVEN** the `XSRF-TOKEN` cookie holds T
- **WHEN** the admin signs out
- **THEN** `DELETE /api/admin/session` carries `X-XSRF-TOKEN: T`
