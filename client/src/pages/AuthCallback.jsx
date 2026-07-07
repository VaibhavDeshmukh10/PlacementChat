import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FullScreenLoader, InlineError } from "../components/ui/Loaders";
import { C } from "../theme";

// Landing page for the OAuth redirect: the backend sends the user here with
// ?token=... — we store it, load the profile, then bounce to the app.
export default function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const token = params.get("token");
    const refresh = params.get("refresh");
    
    console.log("AuthCallback - Token present:", !!token);
    console.log("AuthCallback - Refresh token present:", !!refresh);
    console.log("AuthCallback - URL params:", Object.fromEntries(params));
    
    if (!token) {
      const errorMsg = "No sign-in token was returned. Please try logging in again.";
      setError(errorMsg);
      setDebugInfo(`Token: ${token}, URL params: ${JSON.stringify(Object.fromEntries(params))}`);
      return;
    }
    
    loginWithToken(token)
      .then(() => {
        console.log("AuthCallback - Login successful, navigating to /");
        navigate("/", { replace: true });
      })
      .catch((err) => {
        console.error("AuthCallback - Login failed:", err);
        setError("We couldn't complete sign-in. Please try again.");
        setDebugInfo(err?.message || String(err));
      });
  }, [params, loginWithToken, navigate]);

  if (error) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: C.green050,
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div style={{ maxWidth: 420, width: "100%" }}>
          <InlineError onRetry={() => navigate("/login", { replace: true })}>{error}</InlineError>
          {debugInfo && (
            <div style={{ marginTop: 16, padding: "12px", background: C.greyLine, borderRadius: 8, fontSize: 12, fontFamily: "monospace", color: C.greyText }}>
              Debug: {debugInfo}
            </div>
          )}
        </div>
      </div>
    );
  }

  return <FullScreenLoader label="Signing you in…" />;
}
