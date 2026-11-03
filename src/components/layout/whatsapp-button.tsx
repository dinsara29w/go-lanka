import { MessageCircle } from "lucide-react";

import { strings } from "@/content/strings";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export function WhatsAppButton({ number }: { number: string | null }) {
  if (!number) return null;
  const href = buildWhatsAppUrl(number, strings.whatsapp.defaultMessage);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={strings.whatsapp.label}
      className="fixed bottom-4 right-4 z-50 flex size-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring motion-reduce:transition-none sm:bottom-6 sm:right-6"
    >
      <MessageCircle aria-hidden="true" className="size-6" />
    </a>
  );
}
