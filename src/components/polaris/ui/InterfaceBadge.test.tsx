import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivitySparkline, AvailabilityStatus, CaptureStatus, InterfaceBadge, MetricValue, TrafficStatus } from './InterfaceBadge';

/* The badge and status pieces the Probe Manager, Probe Details and Live Capture share. */

describe('InterfaceBadge', () => {
  it('colours each interface family with its own token', () => {
    const { rerender } = render(<InterfaceBadge name="N2"/>);
    expect(screen.getByText('N2').className).toContain('text-ifc-blue-fg');
    rerender(<InterfaceBadge name="SBI"/>);
    expect(screen.getByText('SBI').className).toContain('text-ifc-purple-fg');
    rerender(<InterfaceBadge name="N3"/>);
    expect(screen.getByText('N3').className).toContain('text-ifc-green-fg');
    rerender(<InterfaceBadge name="N4"/>);
    expect(screen.getByText('N4').className).toContain('text-ifc-amber-fg');
  });

  it('keeps an unlisted interface neutral instead of inventing a colour', () => {
    render(<InterfaceBadge name="T14"/>);
    const badge = screen.getByText('T14');
    expect(badge.className).toContain('text-ifc-gray-fg');
    expect(badge.className).not.toContain('text-ifc-blue-fg');
  });
});

describe('status pieces', () => {
  it('reads availability from the runtime value with its own colours', () => {
    const { rerender } = render(<AvailabilityStatus active/>);
    expect(screen.getByText('Disponible').className).toContain('text-success');
    rerender(<AvailabilityStatus active={false}/>);
    expect(screen.getByText('Indisponible').className).toContain('text-danger');
    rerender(<AvailabilityStatus active={null}/>);
    expect(screen.getByText('Inconnue').className).toContain('text-subtle');
    rerender(<AvailabilityStatus active state="DEGRADED"/>);
    expect(screen.getByText('Dégradé').className).toContain('text-warning');
  });

  it('names the five dumpcap states without claiming traffic', () => {
    const { rerender } = render(<CaptureStatus row={{ state: 'CAPTURING' }}/>);
    expect(screen.getByText('actif')).toBeInTheDocument();
    rerender(<CaptureStatus row={{ state: 'STARTING' }}/>);
    expect(screen.getByText('démarrage')).toBeInTheDocument();
    rerender(<CaptureStatus row={{ state: 'STOPPING' }}/>);
    expect(screen.getByText('arrêt')).toBeInTheDocument();
    rerender(<CaptureStatus row={{ active: false }}/>);
    expect(screen.getByText('inactif')).toBeInTheDocument();
    rerender(<CaptureStatus row={{}}/>);
    expect(screen.getByText('inconnu')).toBeInTheDocument();
  });

  it('reports traffic separately from the process', () => {
    const { rerender } = render(<TrafficStatus packetRate={0} bytesPerSecond={0}/>);
    expect(screen.getByText('aucun paquet')).toBeInTheDocument();
    rerender(<TrafficStatus packetRate={12} bytesPerSecond={null}/>);
    expect(screen.getByText('trafic vu')).toBeInTheDocument();
    rerender(<TrafficStatus packetRate={null} bytesPerSecond={undefined}/>);
    expect(screen.getByText('métrique indisponible')).toBeInTheDocument();
  });

  it('shows a missing measure as a dash and a real zero as zero', () => {
    const { rerender } = render(<MetricValue value={null}/>);
    expect(screen.getByText('—')).toBeInTheDocument();
    rerender(<MetricValue value={0}/>);
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});

describe('ActivitySparkline', () => {
  it('shows a neutral empty state while no sample exists', () => {
    const { container } = render(<ActivitySparkline values={[]}/>);
    expect(screen.getByText('aucun échantillon')).toBeInTheDocument();
    expect(container.querySelector('polyline')).toBeNull();
  });

  it('draws the curve without a baseline when no zero was measured', () => {
    const { container } = render(<ActivitySparkline values={[5, 7, 6]}/>);
    expect(container.querySelector('polyline')).not.toBeNull();
    expect(container.querySelector('line')).toBeNull();
  });

  it('only draws the zero baseline when a zero was really measured', () => {
    const { container } = render(<ActivitySparkline values={[0, 0, 0]}/>);
    expect(container.querySelector('polyline')).not.toBeNull();
    expect(container.querySelector('line')).not.toBeNull();
  });
});
