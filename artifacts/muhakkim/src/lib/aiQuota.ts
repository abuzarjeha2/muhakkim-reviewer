// Global fetch interceptor: when any AI call to the server proxy is blocked
// with 401 (auth required) or 402 (quota exceeded), broadcast a window event
// so the app can show a single sign-in / upgrade modal — without having to edit
// every individual AI call site in the vendored tool suite.

const AI_PATH = (import.meta.env.BASE_URL || "/") + "api/ai";

export const QUOTA_EVENT = "muhakkim:quota";

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  if (input instanceof Request) return input.url;
  return String(input);
}

let installed = false;

export function installQuotaInterceptor(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const origFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await origFetch(input, init);
    try {
      if (
        urlOf(input).includes(AI_PATH) &&
        (res.status === 401 || res.status === 402)
      ) {
        const data = await res
          .clone()
          .json()
          .catch(() => ({}));
        window.dispatchEvent(
          new CustomEvent(QUOTA_EVENT, {
            detail: { status: res.status, ...data },
          }),
        );
      }
    } catch {
      // never let interception break the underlying request
    }
    return res;
  };
}
