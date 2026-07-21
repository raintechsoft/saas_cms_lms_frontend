import { useState, type FormEvent } from "react";

import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { resetPassword } from "../../lib/api";



export function ResetPasswordPage() {

  const navigate = useNavigate();

  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState(searchParams.get("email") ?? "");

  const [tenantSlug, setTenantSlug] = useState(searchParams.get("tenant") ?? "");

  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");

  const [confirmPassword, setConfirmPassword] = useState("");

  const [message, setMessage] = useState("");

  const [error, setError] = useState("");

  const [submitting, setSubmitting] = useState(false);



  async function handleSubmit(event: FormEvent) {

    event.preventDefault();

    setError("");

    setMessage("");

    if (password !== confirmPassword) {

      setError("Passwords do not match");

      return;

    }

    if (!token) {

      setError("Reset token is missing. Open the link from your email again.");

      return;

    }

    setSubmitting(true);

    try {

      const result = await resetPassword({

        email,

        token,

        password,

        tenantSlug: tenantSlug.trim() || undefined,

      });

      setMessage(result.message);

      setTimeout(() => navigate("/login", { replace: true }), 1500);

    } catch (cause) {

      setError(cause instanceof Error ? cause.message : "Unable to reset password");

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

        <h1 className="mt-6 text-3xl font-semibold text-white">Choose a new password</h1>

        <p className="mt-3 text-sm text-slate-400">Enter a new password for your account.</p>



        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>

          <label className="block">

            <span className="mb-2 block text-sm font-medium text-slate-200">Email</span>

            <input

              className="field"

              type="email"

              value={email}

              onChange={(event) => setEmail(event.target.value)}

              required

            />

          </label>

          {tenantSlug !== "" && (

            <label className="block">

              <span className="mb-2 block text-sm font-medium text-slate-200">Workspace slug</span>

              <input

                className="field"

                value={tenantSlug}

                onChange={(event) => setTenantSlug(event.target.value)}

              />

            </label>

          )}

          <label className="block">

            <span className="mb-2 block text-sm font-medium text-slate-200">New password</span>

            <input

              className="field"

              type="password"

              value={password}

              onChange={(event) => setPassword(event.target.value)}

              minLength={8}

              required

              autoFocus

            />

          </label>

          <label className="block">

            <span className="mb-2 block text-sm font-medium text-slate-200">Confirm password</span>

            <input

              className="field"

              type="password"

              value={confirmPassword}

              onChange={(event) => setConfirmPassword(event.target.value)}

              minLength={8}

              required

            />

          </label>



          {message && (

            <p className="rounded-lg border border-emerald-900/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">

              {message}

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

            {submitting ? "Updating…" : "Update password"}

          </button>

        </form>

      </div>

    </main>

  );

}

