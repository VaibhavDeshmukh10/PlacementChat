function getOAuthCallbackUrl(req, provider) {
  const protocol = req?.protocol || 'http';
  const host = req?.get?.('host') || 'localhost:5000';
  const basePath = provider === 'google' ? '/api/auth/google/callback' : '/api/auth/github/callback';
  const envVar = provider === 'google' ? process.env.GOOGLE_CALLBACK_URL : process.env.GITHUB_CALLBACK_URL;

  if (envVar && typeof envVar === 'string' && envVar.trim()) {
    const candidate = envVar.trim();
    try {
      const parsed = new URL(candidate);
      const hostname = parsed.hostname.toLowerCase();
      if (hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.endsWith('.local')) {
        return candidate;
      }
    } catch (error) {
      return candidate;
    }
  }

  return `${protocol}://${host}${basePath}`;
}

module.exports = { getOAuthCallbackUrl };
