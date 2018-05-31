import * as w3u from 'web3-utils';
import { InvalidTokenDecimals } from '../../exceptions';

const arrayOfUnits = Object.keys(w3u.unitMap)
  .filter(k => k !== 'noether')
  .map(k => [w3u.unitMap[k], k])
  .sort((a1, a2) => a1[0].length < a2[0].length ? -1 : a1[0].length > a2[0].length ? 1 : 0);

/**
 * Return nearest unit for specified decimals
 *
 * @param decimals
 */
export function decimalsToUnitMap(decimals: number): string {
  decimals = Math.max(decimals, 1);
  for (let i = 0; i < arrayOfUnits.length - 1; ++i) {
    if (arrayOfUnits[i + 1][0].length - 1 > decimals) {
      return arrayOfUnits[i][1];
    }
  }
  return 'tether';
}

const dictOfdecimalsToUnit = Object.keys(w3u.unitMap)
  .filter(k => k !== 'noether')
  .reduce((p, c) => {
    p[w3u.unitMap[c].length - 1] = c;
    return p;
  }, {});

/**
 *
 * @param valueInWei
 * @param decimals
 */
export function fromWeiToUnitValue(valueInWei: string, decimals: number): string {
  if (!dictOfdecimalsToUnit[decimals]) {
    throw new InvalidTokenDecimals('Invalid token decimals: {{decimals}}', {
      desimals: decimals
    });
  }
  return w3u.fromWei(valueInWei, dictOfdecimalsToUnit[decimals]);
}

/**
 *
 * @param valueInUnit
 * @param decimals
 */
export function fromUnitValueToWei(valueInUnit: string, decimals: number): string {
  if (!dictOfdecimalsToUnit[decimals]) {
    throw new InvalidTokenDecimals('Invalid token decimals: {{decimals}}', {
      decimals: decimals
    });
  }
  return w3u.toWei(valueInUnit, dictOfdecimalsToUnit[decimals]);
}
