import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHealth, usePolarisMode } from './hooks';
export function DataStatus({ t = (v: string) => v }: { t?: (v: string) => string }) {
  const { demo, setDemo } = usePolarisMode(); const health = useHealth(); const client = useQueryClient();
  const label = demo ? 'Données de démo' : health.isPending ? 'Connexion POLARIS…' : health.isError ? `${health.error.message} · nouvelle tentative automatique` : 'POLARIS connecté';
  return <div role="status" className="shrink-0 min-h-8 px-4 py-1 border-b border-border bg-muted flex flex-wrap items-center gap-3 text-xs text-muted-foreground"><span>{t(label)}</span><div className="ml-auto flex items-center gap-3"><label className="flex items-center gap-1.5"><input type="checkbox" aria-label={t('Démo')} checked={demo} onChange={e => setDemo(e.target.checked)} />{t('Démo')}</label><Button variant="ghost" size="icon" className="h-6 w-6" aria-label={t('Actualiser')} title={t('Actualiser')} onClick={() => client.invalidateQueries({ queryKey: ['polaris'] })}><RefreshCw /></Button></div></div>;
}
