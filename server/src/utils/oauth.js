function buildOAuthUserPayload(profile, provider) {
  const email = profile?.emails?.[0]?.value || `${provider}-${profile?.id || profile?.username || 'oauth'}@placementdesk.local`;
  const name = profile?.displayName || profile?.username || 'OAuth User';
  const avatar = profile?.photos?.[0]?.value || null;

  return {
    name,
    email,
    avatar,
    provider,
    providerId: String(profile?.id || profile?.username || ''),
  };
}

module.exports = { buildOAuthUserPayload };
