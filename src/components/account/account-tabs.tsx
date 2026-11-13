"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AccountTab } from "./constants";

const LABELS: Record<AccountTab, string> = {
  profile: "Profile",
  security: "Security",
  notifications: "Notifications",
  privacy: "Privacy",
};

/** Tabs whose selection is mirrored into ?tab= so links and refreshes keep their place. */
export function AccountTabs({ defaultTab, panels }: { defaultTab: AccountTab; panels: Record<AccountTab, React.ReactNode> }) {
  const [tab, setTab] = useState<AccountTab>(defaultTab);
  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        const next = value as AccountTab;
        setTab(next);
        const url = new URL(window.location.href);
        url.searchParams.set("tab", next);
        window.history.replaceState(null, "", url.toString());
      }}
      className="gap-6"
    >
      <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
        {(Object.keys(LABELS) as AccountTab[]).map((key) => (
          <TabsTrigger key={key} value={key}>
            {LABELS[key]}
          </TabsTrigger>
        ))}
      </TabsList>
      {(Object.keys(LABELS) as AccountTab[]).map((key) => (
        <TabsContent key={key} value={key} className="rounded-2xl border bg-card p-5 shadow-card sm:p-7">
          {panels[key]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
