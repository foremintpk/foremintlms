"use client";

import { ImageOff, X } from "lucide-react";
import { useState } from "react";
import { FileUpload, type UploadPurpose } from "@/components/common/file-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Image picker: upload to public storage, or point at an existing site image
 * (e.g. /images/categories/shopify.jpg). Writes the URL into a hidden input.
 */
export function ImageField({
  name,
  value,
  onChange,
  purpose = "marketing",
  label = "Upload an image",
  aspect = "aspect-video",
}: {
  name?: string;
  value: string;
  onChange?: (url: string) => void;
  purpose?: Extract<UploadPurpose, "marketing" | "category_image">;
  label?: string;
  aspect?: string;
}) {
  const [url, setUrl] = useState(value);
  const set = (next: string) => {
    setUrl(next);
    onChange?.(next);
  };

  return (
    <div className="grid gap-3">
      {name ? <input type="hidden" name={name} value={url} /> : null}
      {url ? (
        <div className={`relative w-full max-w-sm overflow-hidden rounded-xl border bg-muted ${aspect}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of arbitrary storage URLs */}
          <img src={url} alt="" className="size-full object-cover" />
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            className="absolute top-2 right-2"
            onClick={() => set("")}
            aria-label="Remove image"
          >
            <X />
          </Button>
        </div>
      ) : (
        <div className={`grid w-full max-w-sm place-items-center rounded-xl border border-dashed bg-muted/40 text-muted-foreground ${aspect}`}>
          <ImageOff className="size-6" aria-hidden />
        </div>
      )}
      <FileUpload
        purpose={purpose}
        accept="image/png,image/jpeg,image/webp,image/avif"
        label={label}
        hint="PNG, JPG, WebP or AVIF"
        onUploaded={(f) => f.publicUrl && set(f.publicUrl)}
      />
      <Input
        value={url}
        onChange={(e) => set(e.target.value)}
        placeholder="…or paste an image path, e.g. /images/categories/shopify.jpg"
        aria-label="Image URL or site path"
      />
    </div>
  );
}
