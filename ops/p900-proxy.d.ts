export interface ProxyTarget {
  host: string;
  port: number;
  scope: 'oiran' | 'polaris' | 'ui';
  path: string;
}

export function targetFor(rawUrl?: string): ProxyTarget | null;
export function forwardedHeaders(headers: Record<string, string>, target: ProxyTarget): Record<string, string>;
