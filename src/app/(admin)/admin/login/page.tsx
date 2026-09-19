import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { loginAction } from "@/app/actions/admin";
import { ActionForm, Field, SubmitButton } from "@/components/admin/AdminUI";

export default async function LoginPage() {
  if (await getAdmin()) redirect("/admin");

  return (
    <div>
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-brand-ink-soft">
        Site administration for Jazeel Restaurant &amp; Café.
      </p>
      <div className="mt-8 rounded border border-brand-line bg-brand-surface p-6">
        <ActionForm action={loginAction}>
          <div className="space-y-4">
            <Field label="Email address" name="email" type="email" required autoComplete="username" dir="ltr" />
            <Field
              label="Password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
            <SubmitButton>Sign in</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
