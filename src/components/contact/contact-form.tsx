"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { TurnstileWidget } from "@/components/security/turnstile-widget";
import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";
import { contactFormSchema, type ContactFormValues } from "@/lib/validation/contact";

type Status = "idle" | "sending" | "success" | "error";

const inputClass =
  "field mt-1.5 placeholder:text-stone/70 aria-invalid:border-destructive aria-invalid:ring-destructive/20";

export function ContactForm({ siteKey }: { siteKey: string | null }) {
  const [status, setStatus] = useState<Status>("idle");
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      message: "",
      website: "",
    },
  });

  if (!siteKey) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6">
        <h2 className="font-heading text-lg font-semibold">{strings.contact.unavailableTitle}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {strings.contact.unavailableBody}
        </p>
      </div>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerMessage(null);

    if (!turnstileToken) {
      setStatus("error");
      setServerMessage(strings.contact.verificationRequired);
      return;
    }

    setStatus("sending");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, turnstileToken }),
      });

      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;

      if (!response.ok || !data?.ok) {
        setStatus("error");
        setServerMessage(data?.message ?? strings.contact.errorBody);
        setTurnstileToken(null);
        setWidgetKey((key) => key + 1);
        return;
      }

      setStatus("success");
      reset();
      setTurnstileToken(null);
      setWidgetKey((key) => key + 1);
    } catch {
      setStatus("error");
      setServerMessage(strings.contact.errorBody);
      setTurnstileToken(null);
      setWidgetKey((key) => key + 1);
    }
  });

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6" role="status">
        <h2 className="font-heading text-xl font-semibold text-emerald-950">
          {strings.contact.successTitle}
        </h2>
        <p className="mt-2 text-sm leading-6 text-emerald-900">{strings.contact.successBody}</p>
        <Button
          type="button"
          variant="outline"
          className="mt-5"
          onClick={() => {
            setStatus("idle");
            setServerMessage(null);
          }}
        >
          {strings.contact.submit}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="text-xs font-semibold text-brand">
            {strings.contact.name}
          </label>
          <input
            id="contact-name"
            autoComplete="name"
            className={inputClass}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? "contact-name-error" : undefined}
            {...register("name")}
          />
          {errors.name ? (
            <p id="contact-name-error" className="mt-1.5 text-sm text-destructive">
              {errors.name.message}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="contact-email" className="text-xs font-semibold text-brand">
            {strings.contact.email}
          </label>
          <input
            id="contact-email"
            type="email"
            autoComplete="email"
            className={inputClass}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "contact-email-error" : undefined}
            {...register("email")}
          />
          {errors.email ? (
            <p id="contact-email-error" className="mt-1.5 text-sm text-destructive">
              {errors.email.message}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <label htmlFor="contact-phone" className="text-xs font-semibold text-brand">
          {strings.contact.phone}
        </label>
        <input
          id="contact-phone"
          type="tel"
          autoComplete="tel"
          className={inputClass}
          aria-invalid={errors.phone ? true : undefined}
          aria-describedby={errors.phone ? "contact-phone-error" : undefined}
          {...register("phone")}
        />
        {errors.phone ? (
          <p id="contact-phone-error" className="mt-1.5 text-sm text-destructive">
            {errors.phone.message}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="contact-message" className="text-xs font-semibold text-brand">
          {strings.contact.message}
        </label>
        <textarea
          id="contact-message"
          rows={6}
          className={inputClass}
          placeholder={strings.contact.messagePlaceholder}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={errors.message ? "contact-message-error" : undefined}
          {...register("message")}
        />
        {errors.message ? (
          <p id="contact-message-error" className="mt-1.5 text-sm text-destructive">
            {errors.message.message}
          </p>
        ) : null}
      </div>

      <div
        className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden"
        aria-hidden="true"
      >
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" tabIndex={-1} autoComplete="off" {...register("website")} />
      </div>

      <TurnstileWidget
        key={widgetKey}
        siteKey={siteKey}
        action="contact"
        onToken={setTurnstileToken}
      />

      {serverMessage ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <p className="font-medium">{strings.contact.errorTitle}</p>
          <p className="mt-1">{serverMessage}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row-reverse sm:items-center sm:justify-end">
        <p className="max-w-sm text-xs leading-5 text-stone">
          {strings.contact.privacyNote}{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            {strings.footer.privacy}
          </Link>
          .
        </p>
        <button
          type="submit"
          className="btn-pill"
          disabled={status === "sending" || !turnstileToken}
        >
          {status === "sending" ? strings.contact.sending : strings.contact.submit}
        </button>
      </div>
    </form>
  );
}
