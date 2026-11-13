import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/learn", "/teach", "/admin", "/api/", "/checkout", "/auth/", "/mfa", "/invite/", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/newsletter/", "/certificates/verify/"],
      },
    ],
    sitemap: appUrl("/sitemap.xml"),
    host: appUrl("/"),
  };
}
