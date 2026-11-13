"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

/** Answers arrive already sanitised by the server component that renders this. */
export function FaqList({ items, defaultOpenFirst = false }: { items: { id: string; question: string; answerHtml: string }[]; defaultOpenFirst?: boolean }) {
  return (
    <Accordion type="single" collapsible defaultValue={defaultOpenFirst && items[0] ? items[0].id : undefined} className="rounded-2xl border bg-card px-5">
      {items.map((item) => (
        <AccordionItem key={item.id} value={item.id}>
          <AccordionTrigger className="py-5 text-left text-base font-semibold hover:no-underline">{item.question}</AccordionTrigger>
          <AccordionContent>
            <div className="prose-foremint pb-2 text-[0.98rem]" dangerouslySetInnerHTML={{ __html: item.answerHtml }} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
