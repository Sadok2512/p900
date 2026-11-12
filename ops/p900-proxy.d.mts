export interface ProxyTarget {
  host: string;
  port: number;
  scope: 'oiran' | 'polaris' | 'ui';
  path: string;
}

export function targetFor(rawUrl?: string): ProxyTarget | null;
export function csrfForToken(token: string): string;
export function basicAuthEnabled(value?: string): boolean;
export function basicAuthorized(headers: Record<string,string>, user?: string, password?: string | null): boolean;
export function forwardedHeaders(headers: Record<string, string>, target: ProxyTarget, method?: string, tokenOverride?: string): Record<string, string>;
