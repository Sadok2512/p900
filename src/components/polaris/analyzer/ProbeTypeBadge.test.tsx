import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ProbeTypeBadge from './ProbeTypeBadge';

describe('ProbeTypeBadge', () => {
  it('rend le probe_type vtap observé avec sa preuve technique', () => {
    render(<ProbeTypeBadge probeType="vtap" />);
    expect(screen.getByText('vtap')).toHaveAttribute('title', 'probe_type=vtap');
  });

  it('n’invente aucun badge quand probe_type est absent', () => {
    const { container } = render(<ProbeTypeBadge />);
    expect(container).toBeEmptyDOMElement();
  });
});
