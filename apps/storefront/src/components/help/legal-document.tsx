import { HelpPage, HelpSection, HelpText } from "@/components/help/help-page";
import type { LegalDocument } from "@/lib/legal";

/**
 * One legal text, rendered the same way as every other help page.
 *
 * Three pages, one component, because the difference between them is the
 * words. Three near-identical files would drift the moment one of them was
 * touched, and these are the pages nobody re-reads.
 *
 * A block without a heading continues the one above it. That is what lets a
 * numbered list sit between two paragraphs of the same clause without
 * inventing a subheading the original text does not have.
 */
export function LegalDocumentPage({ document }: { document: LegalDocument }) {
  return (
    <HelpPage title={document.title}>
      {document.blocks.map((block, index) => {
        const body = (
          <>
            {block.paragraphs.map((paragraph, i) => (
              <HelpText key={i}>{paragraph}</HelpText>
            ))}
            {block.bullets && (
              <ul className="flex list-disc flex-col gap-2 pl-5">
                {block.bullets.map((bullet, i) => (
                  <li key={i} className="font-body text-body text-body-text">
                    {bullet}
                  </li>
                ))}
              </ul>
            )}
          </>
        );

        return block.heading ? (
          <HelpSection key={index} title={block.heading}>
            {body}
          </HelpSection>
        ) : (
          <div key={index} className="flex flex-col gap-3">
            {body}
          </div>
        );
      })}
    </HelpPage>
  );
}
