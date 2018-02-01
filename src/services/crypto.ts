const bip39 = require('bip39');
const hdkey = require('ethereumjs-wallet/hdkey');
import * as web3utils from 'web3-utils';

/**
 *
 * @param contractAddress
 */
export function toEthChecksumAddress(contractAddress: string): string {
  return web3utils.toChecksumAddress(contractAddress)
}

/**
 *
 */
export function generateMnemonic(): string {
  return bip39.generateMnemonic();
}

/**
 *
 * @param mnemonic
 * @param salt
 */
export function getPrivateKeyByMnemonicAndSalt(mnemonic: string, salt: string) {
  // get seed
  const hdWallet = hdkey.fromMasterSeed(bip39.mnemonicToSeed(mnemonic, salt));

  // get first of available wallets
  const path = 'm/44\'/60\'/0\'/0/0';

  // get wallet
  const wallet = hdWallet.derivePath(path).getWallet();

  // get private key
  return '0x' + wallet.getPrivateKey().toString('hex');
}
