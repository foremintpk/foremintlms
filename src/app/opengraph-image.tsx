import { OG_SIZE, renderOgImage } from "@/components/site/og/render";

export const alt = "Foremint Academy — practical skills for the digital economy";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return renderOgImage({ title: "Build skills. Create opportunities. Grow beyond limits." });
}
