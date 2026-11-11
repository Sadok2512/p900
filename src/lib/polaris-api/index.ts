import packageInfo from '../../../package.json';
export * from './client';
export * from './types';
export * from './adapters';
export * from './hooks';
export * from './live-status';
export const UI_VERSION = packageInfo.version;
export const TRAFFIC_ENABLED = import.meta.env['VITE_FEATURE_TRAFFIC'] === 'true';
