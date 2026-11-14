import "server-only";
import { parseSelectorSettings, type SelectorSettings } from "@/lib/domain/commerce";
import { getPublicSetting, getSetting } from "@/lib/settings";

/** Course selector configuration (Admin → Public course pricing). Public setting. */
export async function getSelectorSettings(): Promise<SelectorSettings> {
  return parseSelectorSettings(await getPublicSetting<unknown>("commerce.selector", {}));
}

/** How long a generated package payment link stays payable. */
export async function getOrderLinkTtlHours(): Promise<number> {
  const hours = Number(await getSetting<number>("commerce.order_link_ttl_hours", 72));
  return Number.isFinite(hours) ? Math.min(Math.max(Math.round(hours), 1), 720) : 72;
}
