/** @type {import('astro').APIRoute} */
export const GET = () => {
  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    "session_id=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
  ); // Expire immediately
  headers.append("Location", "/");

  return new Response(null, {
    status: 302,
    headers,
  });
};
