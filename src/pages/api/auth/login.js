/** @type {import('astro').APIRoute} */
export const GET = ({ redirect }) => {
  const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
  const PUBLIC_URL = Deno.env.get('PUBLIC_URL') || 'http://localhost:8000';
  const REDIRECT_URI = `${PUBLIC_URL}/api/auth/callback`;

  // Required scopes for Calendar access
  const scope = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/calendar.events',
  ].join(' ');

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scope);
  // This is CRITICAL for background jobs. It forces Google to return a refresh_token
  url.searchParams.set('access_type', 'offline');
  // Forces the consent prompt to appear every time so we ALWAYS get a refresh_token back (useful in dev)
  url.searchParams.set('prompt', 'consent');

  return redirect(url.toString(), 302);
};