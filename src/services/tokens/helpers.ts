import * as w3u from 'web3-utils';

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
  for (let i = 0; i < arrayOfUnits.length; ++i) {
    if (arrayOfUnits[i][0].length > decimals) {
      return arrayOfUnits[i][1];
    }
  }
  return 'tether';
}
