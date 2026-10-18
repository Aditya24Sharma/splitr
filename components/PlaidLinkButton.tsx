"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Button, type ButtonVariant } from "@/components/ui/Button";

const LINK_TOKEN_KEY = "plaid:link_token";

// Resuming a Plaid OAuth redirect needs the link token stored before the
// redirect plus the exact redirect URL; read both once, outside the render
// cycle. Returns null on the server and on ordinary (non-redirect) loads.
function readOAuthRedirect(): { token: string | null; redirectUri: string } | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("oauth_state_id")) return null;
  return { token: sessionStorage.getItem(LINK_TOKEN_KEY), redirectUri: window.location.href };
}

export function PlaidLinkButton({
  onLinked,
  variant = "primary",
}: {
  onLinked: (institutionName: string | null) => void;
  variant?: ButtonVariant;
}) {
  const [oauthRedirect] = useState(readOAuthRedirect);
  const [linkToken, setLinkToken] = useState<string | null>(oauthRedirect?.token ?? null);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(
    oauthRedirect && !oauthRedirect.token ? "The bank sign-in expired. Please try linking again." : null
  );
  const autoOpenedRef = useRef(false);
  const receivedRedirectUri = oauthRedirect?.token ? oauthRedirect.redirectUri : undefined;

  useEffect(() => {
    if (oauthRedirect) {
      if (!oauthRedirect.token) window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    let cancelled = false;
    fetch("/api/plaid/link-token", { method: "POST" })
      .then((r) => r.json())
      .then((d: { link_token?: string; error?: string }) => {
        if (cancelled) return;
        if (d.link_token) {
          setLinkToken(d.link_token);
          sessionStorage.setItem(LINK_TOKEN_KEY, d.link_token);
        } else {
          setError(d.error ?? "Plaid isn’t set up.");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Couldn’t reach Plaid.");
      });
    return () => {
      cancelled = true;
    };
  }, [oauthRedirect]);

  const onSuccess = useCallback(
    async (publicToken: string) => {
      setLinking(true);
      setError(null);
      try {
        const res = await fetch("/api/plaid/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token: publicToken }),
        });
        const data = (await res.json()) as { institution_name?: string | null; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Linking failed");
        sessionStorage.removeItem(LINK_TOKEN_KEY);
        if (receivedRedirectUri) window.history.replaceState({}, "", window.location.pathname);
        onLinked(data.institution_name ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Linking failed");
      } finally {
        setLinking(false);
      }
    },
    [onLinked, receivedRedirectUri]
  );

  const { open, ready } = usePlaidLink({ token: linkToken, receivedRedirectUri, onSuccess });

  useEffect(() => {
    if (!receivedRedirectUri || !ready || autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    open();
  }, [receivedRedirectUri, ready, open]);

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button variant={variant} onClick={() => open()} disabled={!ready || !linkToken || linking}>
        {linking ? "Linking…" : "+ Link a bank"}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-danger font-semibold">
          {error}
        </span>
      )}
    </span>
  );
}
