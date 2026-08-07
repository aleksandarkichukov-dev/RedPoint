import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/help/legal-document";
import { TERMS } from "@/lib/legal";

export const metadata: Metadata = {
  title: TERMS.title,
  description: TERMS.description,
};

export default function TermsPage() {
  return <LegalDocumentPage document={TERMS} />;
}
