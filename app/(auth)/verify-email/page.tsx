"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, ApiClientError } from "@/lib/client";

function Verify() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<{ status: "loading" | "ok" | "error"; message?: string }>({ status: "loading" });
  useEffect(() => {
    if (!token) return setState({ status: "error", message: "This link is incomplete." });
    api("/auth/verify-email", { json: { token } })
      .then(() => setState({ status: "ok" }))
      .catch((e) => setState({ status: "error", message: e instanceof ApiClientError ? e.message : "Verification failed" }));
  }, [token]);
  return (
    <div className="space-y-3" aria-live="polite">
      <h1>{state.status === "loading" ? "Verifying your email" : state.status === "ok" ? "Email verified" : "Verification failed"}</h1>
      {state.message && <p>{state.message}</p>}
      <Link href="/dashboard" className="font-bold text-primary underline">Continue to MediFlow</Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return <Suspense><Verify /></Suspense>;
}
