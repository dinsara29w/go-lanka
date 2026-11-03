"use client";

import { useId, useRef, useState } from "react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";

type UploadedImage = { url: string; alt: string };

function UploadControl({
  category,
  csrfToken,
  alt,
  onAltChange,
  onUploaded,
}: {
  category: "packages" | "destinations";
  csrfToken: string;
  alt: string;
  onAltChange: (value: string) => void;
  onUploaded: (image: UploadedImage) => void;
}) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    if (!file || alt.trim().length === 0) return;
    setUploading(true);
    setError(null);

    const body = new FormData();
    body.append("file", file);
    body.append("alt", alt.trim());
    body.append("category", category);

    try {
      const response = await fetch("/api/admin/uploads", {
        method: "POST",
        headers: { "X-CSRF-Token": csrfToken },
        body,
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        url?: string;
        alt?: string;
        message?: string;
      } | null;

      if (!response.ok || !data?.ok || !data.url) {
        setError(data?.message ?? strings.admin.imageUploadFailed);
        return;
      }

      onUploaded({ url: data.url, alt: data.alt ?? alt.trim() });
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      setError(strings.admin.imageUploadFailed);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border bg-muted/20 p-4">
      <div>
        <label htmlFor={`${id}-file`} className="text-sm font-medium">
          {strings.admin.image}
        </label>
        <input
          ref={fileRef}
          id={`${id}-file`}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="mt-1.5 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium"
        />
        <p className="mt-1 text-xs text-muted-foreground">{strings.admin.imageFormatHint}</p>
      </div>

      <div>
        <label htmlFor={`${id}-alt`} className="text-sm font-medium">
          {strings.admin.altText}
        </label>
        <input
          id={`${id}-alt`}
          value={alt}
          onChange={(event) => onAltChange(event.target.value)}
          maxLength={200}
          className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          placeholder={strings.admin.altHint}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        variant="outline"
        disabled={!file || alt.trim().length === 0 || uploading}
        onClick={upload}
      >
        {uploading ? strings.admin.uploadingImage : strings.admin.uploadImage}
      </Button>
    </div>
  );
}

export function ImageUploadField({
  name,
  altName,
  category,
  csrfToken,
  initialUrl,
  initialAlt,
}: {
  name: string;
  altName: string;
  category: "packages" | "destinations";
  csrfToken: string;
  initialUrl?: string | null;
  initialAlt?: string | null;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [alt, setAlt] = useState(initialAlt ?? "");

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={url} />
      <input type="hidden" name={altName} value={alt} />

      {url ? (
        <div className="space-y-2">
          <Image
            src={url}
            alt={alt || strings.admin.image}
            width={320}
            height={180}
            unoptimized
            className="h-40 w-full rounded-xl border border-border object-cover"
          />
          <Button type="button" variant="outline" size="sm" onClick={() => setUrl("")}>
            {strings.admin.removeImage}
          </Button>
        </div>
      ) : null}

      <UploadControl
        category={category}
        csrfToken={csrfToken}
        alt={alt}
        onAltChange={setAlt}
        onUploaded={(image) => {
          setUrl(image.url);
          setAlt(image.alt);
        }}
      />
    </div>
  );
}

export function GalleryEditor({
  name,
  category,
  csrfToken,
  initialImages,
}: {
  name: string;
  category: "packages" | "destinations";
  csrfToken: string;
  initialImages: Array<{ path: string; alt: string }>;
}) {
  const [images, setImages] = useState(initialImages);
  const [draftAlt, setDraftAlt] = useState("");

  function updateImage(index: number, patch: Partial<{ path: string; alt: string }>) {
    setImages((current) =>
      current.map((image, imageIndex) => (imageIndex === index ? { ...image, ...patch } : image)),
    );
  }

  function move(index: number, direction: -1 | 1) {
    setImages((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <input type="hidden" name={name} value={JSON.stringify(images)} />
      <div>
        <p className="text-sm font-medium">{strings.admin.gallery}</p>
        <p className="text-xs text-muted-foreground">{strings.admin.galleryHint}</p>
      </div>

      {images.length === 0 ? (
        <p className="text-sm text-muted-foreground">{strings.admin.noGalleryImages}</p>
      ) : (
        <div className="space-y-3">
          {images.map((image, index) => (
            <div
              key={`${image.path}-${index}`}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center"
            >
              <Image
                src={image.path}
                alt={image.alt || strings.admin.image}
                width={160}
                height={100}
                unoptimized
                className="h-20 w-32 rounded-lg border border-border object-cover"
              />
              <input
                value={image.alt}
                onChange={(event) => updateImage(index, { alt: event.target.value })}
                maxLength={200}
                aria-label={`${strings.admin.altText} ${index + 1}`}
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => move(index, -1)}>
                  {strings.admin.moveUp}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => move(index, 1)}>
                  {strings.admin.moveDown}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setImages((current) => current.filter((_, i) => i !== index))}
                >
                  {strings.admin.remove}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <UploadControl
        category={category}
        csrfToken={csrfToken}
        alt={draftAlt}
        onAltChange={setDraftAlt}
        onUploaded={(image) => {
          setImages((current) => [...current, { path: image.url, alt: image.alt }]);
          setDraftAlt("");
        }}
      />
    </div>
  );
}
