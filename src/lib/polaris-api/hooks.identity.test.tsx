import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useIdentityLookup } from "./hooks";

describe("identity lookup privacy contract", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses POST /identities/lookup and keeps the clear value out of the URL", async () => {
    const clearIdentity = "001010123456789";
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ data: { subscriber_pseudonym: "subscriber-psn-test" }, meta: {} }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetcher);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useIdentityLookup(clearIdentity), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url, options] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe("/api/v1/identities/lookup");
    expect(String(url)).not.toContain(clearIdentity);
    expect(options).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(options.body))).toEqual({
      value: clearIdentity,
      page: 1,
      page_size: 50,
    });
  });
});
