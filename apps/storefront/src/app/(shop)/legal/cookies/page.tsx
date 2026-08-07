import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/help/legal-document";
import { COOKIES } from "@/lib/legal";

export const metadata: Metadata = {
  title: COOKIES.title,
  description: COOKIES.description,
};

export default function CookiesPage() {
  return <LegalDocumentPage document={COOKIES} />;
}
