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
export function operatorOnlyPath(rawUrl?: string): boolean;
export function proxyAccess(rawUrl?: string, method?: string, headers?: Record<string, string>, user?: string, password?: string | null, enabled?: boolean): {authenticated: boolean; status: number};
export function forwardedHeaders(headers: Record<string, string>, target: ProxyTarget, method?: string, options?: {operatorAuthenticated?: boolean; tokenOverride?: string}): Record<string, string>;
