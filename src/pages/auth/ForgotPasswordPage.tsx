import { useEffect, useState, type FormEvent } from "react";

import { Link, useSearchParams } from "react-router-dom";

import { forgotPassword } from "../../lib/api";



export function ForgotPasswordPage() {

  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState(searchParams.get("email") ?? "");

  const [tenantSlug, setTenantSlug] = useState(searchParams.get("tenant") ?? "demo-school");

  const [message, setMessage] = useState("");

  const [devResetUrl, setDevResetUrl] = useState("");

  const [error, setError] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const isPlatform = !searchParams.get("tenant") && searchParams.get("platform") === "1";



  useEffect(() => {

    if (searchParams.get("tenant")) {

      setTenantSlug(searchParams.get("tenant") ?? "");

    }

  }, [searchParams]);



  async function handleSubmit(event: FormEvent) {

    event.preventDefault();

    setError("");

    setMessage("");

    setDevResetUrl("");

    setSubmitting(true);

    try {

      const result = await forgotPassword({

        email,

        tenantSlug: isPlatform ? undefined : tenantSlug.trim() || undefined,

      });

      setMessage(result.message);

      if (result.devResetUrl) setDevResetUrl(result.devResetUrl);

    } catch (cause) {

      setError(cause instanceof Error ? cause.message : "Unable to send reset email");

    } finally {

      setSubmitting(false);

    }

  }



  return (

    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12">

      <div className="w-full max-w-md">

        <Link to="/login" className="text-sm font-medium text-slate-400 hover:text-white">

          ← Back to login

        </Link>

        <h1 className="mt-6 text-3xl font-semibold text-white">Forgot password</h1>

        <p className="mt-3 text-sm text-slate-400">

          Enter your account email and we&apos;ll send reset instructions.

        </p>



        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>

          {!isPlatform && (

            <label className="block">

              <span className="mb-2 block text-sm font-medium text-slate-200">Workspace slug</span>

              <input

                className="field"

                value={tenantSlug}

                onChange={(event) => setTenantSlug(event.target.value)}

                placeholder="demo-school"

                required

              />

            </label>

          )}

          <label className="block">

            <span className="mb-2 block text-sm font-medium text-slate-200">Email</span>

            <input

              className="field"

              type="email"

              value={email}

              onChange={(event) => setEmail(event.target.value)}

              required

              autoFocus

            />

          </label>



          {message && (

            <p className="rounded-lg border border-emerald-900/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">

              {message}

            </p>

          )}

          {devResetUrl && (

            <p className="rounded-lg border border-amber-900/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">

              Dev mode (SMTP off):{" "}

              <a className="underline" href={devResetUrl}>

                open reset link

              </a>

            </p>

          )}

          {error && (

            <p className="rounded-lg border border-rose-900 bg-rose-950/60 px-4 py-3 text-sm text-rose-200">

              {error}

            </p>

          )}



          <button

            className="w-full rounded-lg bg-indigo-500 px-4 py-3 font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"

            type="submit"

            disabled={submitting}

          >

            {submitting ? "Sending…" : "Send reset link"}

          </button>

        </form>

      </div>

    </main>

  );

}

