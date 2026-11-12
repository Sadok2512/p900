import { describe, expect, it } from 'vitest';
import { identityProofs, identityValue, observedIdentity } from './identities';

describe('operator identity aliases', () => {
  const subscriber=()=>['001','01','012','345','6789'].join('');
  const temporary=()=>['0x','A1','B2','C3','D4'].join('');

  it('uses the clear 5G aliases without inventing an absent identity', () => {
    const identities={supi:subscriber(),guti:[{value:temporary()}],pei:{value:['35','2099','00','176','148'].join('')},gpsi:['33','6','00','00','00','01'].join('')};
    expect(identityValue(identities,'subscriber')).toBe(identities.supi);
    expect(identityValue(identities,'temporary')).toBe(identities.guti[0]?.value);
    expect(identityValue(identities,'equipment')).toBe(identities.pei.value);
    expect(identityValue(identities,'directory')).toBe(identities.gpsi);
    expect(observedIdentity(identities,'s_tmsi')).toBe('non observé');
  });

  it('keeps proof metadata separate from the displayed value', () => {
    const proof={value:temporary(),capture_id:'capture-test',packet_number:7};
    expect(identityProofs({tmsi:[proof]},'temporary')).toEqual([proof]);
  });
});
