"use client";

import { useRef, useState } from "react";

import { TurnstileWidget } from "@/components/security/turnstile-widget";
import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

export function PhotoSubmissionForm({
  siteKey,
  packages,
}: {
  siteKey: string | null;
  packages: Array<{ id: string; title: string }>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!siteKey || !file || !consent || !token) return;

    setSubmitting(true);
    setError(null);
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    formData.set("file", file);
    formData.set("consent", "on");
    formData.set("turnstileToken", token);

    try {
      const response = await fetch("/api/photos", { method: "POST", body: formData });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;

      if (!response.ok || !data?.ok) {
        setError(data?.message ?? strings.photos.error);
        setToken(null);
        setWidgetKey((key) => key + 1);
        return;
      }

      formRef.current?.reset();
      setFile(null);
      setConsent(false);
      setToken(null);
      setWidgetKey((key) => key + 1);
      setMessage(strings.photos.success);
    } catch {
      setError(strings.photos.error);
      setToken(null);
      setWidgetKey((key) => key + 1);
    } finally {
      setSubmitting(false);
    }
  }

  if (!siteKey) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
        {strings.photos.verificationError}
      </p>
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-4">
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <div>
        <label htmlFor="photo-file" className="text-sm font-medium">
          {strings.photos.file}
        </label>
        <input
          id="photo-file"
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="mt-1.5 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium"
        />
      </div>

      <div>
        <label htmlFor="photo-package" className="text-sm font-medium">
          {strings.photos.package}
        </label>
        <select id="photo-package" name="packageId" defaultValue="" className={inputClass}>
          <option value="">{strings.photos.noPackage}</option>
          {packages.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="photo-submitter" className="text-sm font-medium">
          {strings.photos.submitterName}
        </label>
        <input id="photo-submitter" name="submitterName" maxLength={200} className={inputClass} />
      </div>

      <div>
        <label htmlFor="photo-caption" className="text-sm font-medium">
          {strings.photos.caption}
        </label>
        <input id="photo-caption" name="caption" maxLength={1000} className={inputClass} />
      </div>

      <div
        className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden"
        aria-hidden="true"
      >
        <label htmlFor="photo-website">Website</label>
        <input id="photo-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <label className="flex items-start gap-2 text-sm leading-6">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          required
          className="mt-1"
        />
        <span>{strings.photos.consent}</span>
      </label>

      <TurnstileWidget key={widgetKey} siteKey={siteKey} action="photos" onToken={setToken} />

      <Button type="submit" disabled={submitting || !file || !consent || !token}>
        {submitting ? strings.photos.sending : strings.photos.submit}
      </Button>
    </form>
  );
}
