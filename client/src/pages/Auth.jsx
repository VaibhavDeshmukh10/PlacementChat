import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Github, ArrowLeft } from "lucide-react";
import { API_BASE } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui/Toast";
import { C } from "../theme";

function GoogleIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v2.98h3.88c2.27-2.09 3.58-5.17 3.58-8.8z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-2.98c-1.08.72-2.45 1.15-4.05 1.15-3.11 0-5.75-2.1-6.69-4.93H1.3v3.07C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.31 14.33c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.7H1.3A11.98 11.98 0 000 12.05c0 1.94.46 3.77 1.3 5.35l4.01-3.07z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.3 6.7l4.01 3.07C6.25 6.94 8.89 4.75 12 4.75z" />
    </svg>
  );
}

function Button({ variant = "default", icon, label, onClick, loading = false, disabled = false, style = {}, ...props }) {
  const [hover, setHover] = useState(false);
  const isGithub = variant === "github";
  
  const baseStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    fontSize: 14.5,
    fontWeight: 600,
    padding: "12px 16px",
    borderRadius: 9,
    cursor: (loading || disabled) ? "not-allowed" : "pointer",
    transition: "background 0.15s ease, border-color 0.15s ease",
    opacity: (loading || disabled) ? 0.7 : 1,
    ...style
  };

  let buttonStyle = baseStyle;
  
  if (isGithub) {
    buttonStyle = {
      ...baseStyle,
      border: "none",
      background: hover ? "#000000" : C.black,
      color: C.white,
    };
  } else {
    buttonStyle = {
      ...baseStyle,
      border: `1px solid ${hover ? C.black : C.greyLine}`,
      background: C.white,
      color: C.black,
    };
  }

  return (
    <button
      onClick={(loading || disabled) ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={buttonStyle}
      disabled={loading || disabled}
      {...props}
    >
      {loading ? "Loading..." : (
        <>
          {icon}
          {label}
        </>
      )}
    </button>
  );
}

export default function AuthPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [config, setConfig] = useState({ 
    google: false, 
    github: false, 
    devLogin: false, 
    demoAdmin: false 
  });
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);

  useEffect(() => {
    // Check for OAuth error in URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    
    if (error) {
      let errorMessage = 'Authentication failed';
      
      switch (error) {
        case 'oauth_state_mismatch':
          errorMessage = 'Security validation failed. Please try signing in again.';
          break;
        case 'oauth_error':
          errorMessage = 'Authentication service error. Please try again.';
          break;
        case 'google_auth_failed':
          errorMessage = 'Google authentication failed. Please try again.';
          break;
        case 'github_auth_failed':
          errorMessage = 'GitHub authentication failed. Please try again.';
          break;
        case 'oauth_failed':
          errorMessage = 'Authentication was cancelled or failed. Please try again.';
          break;
        default:
          errorMessage = `Authentication error: ${error}`;
      }
      
      toast.error(errorMessage);

      // Clear the error from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast]);

  useEffect(() => {
    // Fetch auth configuration
    fetch(`${API_BASE}/api/auth/config`)
      .then(res => res.json())
      .then(data => {
        setConfig(data);
        setConfigLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch auth config:', err);
        toast.error("Failed to load authentication options");
        setConfig({ google: false, github: false, devLogin: false, demoAdmin: false });
        setConfigLoading(false);
      });
  }, [toast]);

  const handleOAuthLogin = (provider) => {
    setLoading(true);
    window.location.href = `${API_BASE}/api/auth/${provider}`;
  };

  // Check if any authentication methods are available
  const hasOAuth = config.google || config.github;
  const hasAnyMethod = hasOAuth;

  if (configLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: C.green050,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", color: C.greyText }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>Loading authentication options...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.green050,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, sans-serif",
        padding: 20,
        position: "relative",
      }}
    >
      <Link
        to="/"
        style={{
          position: "absolute",
          top: 24,
          left: 24,
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13.5,
          color: C.greyText,
          textDecoration: "none",
        }}
      >
        <ArrowLeft size={15} />
        Back to PlacementDesk
      </Link>

      <div
        style={{
          background: C.white,
          border: `1px solid ${C.greyLine}`,
          borderRadius: 14,
          padding: "36px 32px",
          width: "100%",
          maxWidth: 400,
          boxShadow: "0 20px 50px -24px rgba(0,0,0,0.15)",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 9,
            background: C.green700,
            color: C.white,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Newsreader, serif",
            fontWeight: 700,
            fontSize: 18,
            margin: "0 auto 20px",
          }}
        >
          P
        </div>

        <h1 style={{ 
          fontFamily: "Newsreader, serif", 
          fontWeight: 600, 
          fontSize: 24, 
          textAlign: "center", 
          margin: "0 0 6px", 
          color: C.black, 
          letterSpacing: "-0.01em" 
        }}>
          Welcome to PlacementDesk
        </h1>
        <p style={{ 
          fontSize: 13.5, 
          color: C.greyText, 
          textAlign: "center", 
          margin: "0 0 26px", 
          lineHeight: 1.5 
        }}>
          Sign in to join company rooms and share interview experiences.
        </p>

        {hasAnyMethod ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* OAuth Methods Only - No Demo Code */}
            {config.google && (
              <Button
                icon={<GoogleIcon />}
                label="Sign in with Google"
                onClick={() => handleOAuthLogin('google')}
                loading={loading}
              />
            )}
            
            {config.github && (
              <Button
                variant="github"
                icon={<Github size={18} />}
                label="Sign in with GitHub"
                onClick={() => handleOAuthLogin('github')}
                loading={loading}
              />
            )}

            {!hasOAuth && (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <p style={{ fontSize: 13, color: C.greyText, margin: "8px 0 0" }}>
                  Authentication methods are being configured.
                </p>
                <p style={{ fontSize: 12, color: C.greyText, margin: "8px 0 0", lineHeight: 1.4 }}>
                  Please contact your administrator.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <p style={{ fontSize: 13, color: C.red700, margin: "8px 0 0" }}>
              No authentication methods are currently available.
            </p>
            <p style={{ fontSize: 12, color: C.greyText, margin: "8px 0 0", lineHeight: 1.4 }}>
              Please contact your administrator to configure authentication.
            </p>
          </div>
        )}

        {/* Security Notice */}
        <div style={{ 
          marginTop: 24, 
          padding: "12px 16px", 
          background: C.green050, 
          borderRadius: 8, 
          border: `1px solid ${C.green200}` 
        }}>
          <p style={{ 
            fontSize: 11, 
            color: C.greyText, 
            margin: 0, 
            lineHeight: 1.4,
            textAlign: "center"
          }}>
            🔒 Your connection is secured with enterprise-grade encryption and security measures.
          </p>
        </div>
      </div>
    </div>
  );
}
