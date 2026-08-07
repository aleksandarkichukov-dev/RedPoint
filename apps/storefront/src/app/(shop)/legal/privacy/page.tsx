import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/help/legal-document";
import { PRIVACY } from "@/lib/legal";

export const metadata: Metadata = {
  title: PRIVACY.title,
  description: PRIVACY.description,
};

export default function PrivacyPage() {
  return <LegalDocumentPage document={PRIVACY} />;
}
