import { clampTransformWidth, isAllowedBlobImageUrl } from "./_lib/guestImageProxy";

/**
 * TASK-7821 — same-origin image transform proxy.
 *
 * Listing photos live on Azure Blob (`Server: Windows-Azure-Blob`) with no resize
 * pipeline and no Cache-Control. This Function fetches the allowlisted blob through
 * Cloudflare Image Resizing (`cf.image`) so the browser downloads a width-appropriate
 * WebP/AVIF instead of a multi-MB original, and the response is cacheable on the
 * existing guest-portal zone (no new vendor).
 *
 * If Image Resizing is not enabled on the zone, `cf.image` is ignored and the original
 * bytes are still proxied with a long Cache-Control — images keep working; transform
 * is additive.
 *
 * Query: `/img?u=<https blob url>&w=<160-1600>`
 */

type PagesContext = {
  request: Request;
};

type CfRequestInit = RequestInit & {
  cf?: {
    image?: {
      width: number;
      quality: number;
      format: "auto";
      fit: "scale-down";
    };
    cacheTtl?: number;
    cacheEverything?: boolean;
  };
};

const CACHE_CONTROL = "public, max-age=31536000, immutable";

function deny(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return deny(405, "Method Not Allowed");
  }

  const url = new URL(context.request.url);
  const originUrl = (url.searchParams.get("u") ?? "").trim();
  if (!isAllowedBlobImageUrl(originUrl)) {
    return deny(400, "Invalid image origin");
  }

  const width = clampTransformWidth(url.searchParams.get("w"));

  const init: CfRequestInit = {
    method: "GET",
    redirect: "manual",
    headers: {
      Accept: context.request.headers.get("Accept") ?? "image/avif,image/webp,image/*,*/*;q=0.8",
    },
    cf: {
      image: {
        width,
        quality: 75,
        format: "auto",
        fit: "scale-down",
      },
      cacheTtl: 31536000,
      cacheEverything: true,
    },
  };

  let upstream: Response;
  try {
    upstream = await fetch(originUrl, init);
  } catch {
    return deny(502, "Image origin unreachable");
  }

  if (upstream.status >= 300 && upstream.status < 400) {
    return deny(400, "Redirected image origin is not allowed");
  }

  if (!upstream.ok) {
    return deny(upstream.status === 404 ? 404 : 502, "Image origin failed");
  }

  const contentType = upstream.headers.get("Content-Type") ?? "image/jpeg";
  if (!contentType.toLowerCase().startsWith("image/")) {
    return deny(502, "Origin did not return an image");
  }

  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", CACHE_CONTROL);
  headers.set("X-Atlas-Image-Proxy", "1");
  headers.set("X-Atlas-Image-Width", String(width));
  const acceptRanges = upstream.headers.get("Accept-Ranges");
  if (acceptRanges) headers.set("Accept-Ranges", acceptRanges);

  return new Response(upstream.body, {
    status: 200,
    headers,
  });
};
