import { PUBLIC_WHATSAPP_NUMBER } from "astro:env/client";
import { SITE } from "@/config/site";

/** URL wa.me con mensaje prellenado. */
export function whatsappUrl(message: string = SITE.whatsappDefaultMessage): string {
  const number = (PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
