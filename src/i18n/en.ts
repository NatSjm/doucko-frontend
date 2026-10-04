/**
 * Admin UI catalog (English, NFR-9, decision OQ-6). Keys are namespaced `admin.*`. Later admin
 * slices add theirs.
 */
export const en = {
  'admin.session.checking': 'Checking your session…',
  'admin.session.unreachable': 'Could not reach the server.',
  'admin.session.retry': 'Try again',
  'admin.signIn.title': 'Admin sign-in',
  'admin.signIn.password': 'Password',
  'admin.signIn.submit': 'Sign in',
  'admin.signIn.invalid': 'That password is not correct.',
  'admin.signIn.failed': 'Sign-in failed. Check that the server is running and try again.',
  'admin.home.title': 'Admin',
  'admin.home.signedIn': 'You are signed in.',
  'admin.home.signOut': 'Sign out',
  'admin.home.signOutFailed': 'Sign-out failed. Reload the page and try again.',
} as const;
