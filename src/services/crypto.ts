import * as crypto from 'crypto';
const bip39 = require('bip39');
const hdkey = require('ethereumjs-wallet/hdkey');
import * as web3utils from 'web3-utils';
import config from '../config';

/**
 *
 * @param contractAddress
 */
export function toEthChecksumAddress(contractAddress: string): string {
  return web3utils.toChecksumAddress(contractAddress);
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

/**
 *
 * @param text
 */
export function getSha256HexHash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 *
 * @param inputBuffer
 * @param keys
 *
 * @example
 * const mc = new MasterKeySecret();
 * const encData = mc.encrypt(new Buffer('Hello worldHello worldHello worldHello worldHello world', 'utf8'));
 * const keys1 = [new Buffer('1', 'utf-8'), new Buffer('a', 'utf-8')];
 * const keys2 = [new Buffer('1', 'utf-8'), new Buffer('b', 'utf-8')];
 * const encMasterKey1 = mc.getEncryptedMasterKey(keys1);
 * const encMasterKey2 = mc.getEncryptedMasterKey(keys2);
 * console.log('data>', encData.toString('hex'));
 * console.log('k1>', encMasterKey1.toString('hex'));
 * console.log('rk>', encMasterKey2.toString('hex'));
 *
 */
function encrypt(inputBuffer: Buffer, keys: Buffer[]): Buffer {
  let outBuffer: Buffer;
  keys.map((key) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-ctr', Buffer.alloc(32).fill(key), iv);
    outBuffer = Buffer.concat([cipher.update(inputBuffer), cipher.final()]);
    inputBuffer = Buffer.concat([iv, outBuffer]);
  });
  return inputBuffer;
}

/**
 *
 * @param inputBuffer
 * @param keys
 */
function decrypt(inputBuffer: Buffer, keys: Buffer[]): Buffer {
  let outBuffer: Buffer;
  keys.map((key) => {
    const iv = inputBuffer.slice(0, 16);
    const decipher = crypto.createDecipheriv('aes-256-ctr', Buffer.alloc(32).fill(key), iv);
    outBuffer = Buffer.concat([decipher.update(inputBuffer.slice(16)), decipher.final()]);
    inputBuffer = Buffer.from(outBuffer);
  });
  return inputBuffer;
}

/**
 *
 */
export class MasterKeySecret {
  public key: Buffer;

  /**
   *
   */
  constructor() {
    this.key = this.generateRandomKey();
  }

  /**
   *
   */
  generateRandomKey(): Buffer {
    return crypto.randomBytes(32);
  }

  /**
   *
   * @param keys
   */
  getEncryptedMasterKey(keys: Buffer[]): Buffer {
    let outBuffer: Buffer;
    return encrypt(this.key, keys);
  }

  /**
   *
   * @param inputBuffer
   */
  encrypt(inputBuffer: Buffer): Buffer {
    let outBuffer: Buffer;
    return encrypt(inputBuffer, [this.key]);
  }

  /**
   *
   * @param inputBuffer
   * @param keys
   * @param encryptedMasterKey
   */
  decrypt(inputBuffer: Buffer, keys: Buffer[], encryptedMasterKey: Buffer): Buffer {
    let outBuffer: Buffer;
    return decrypt(inputBuffer, [decrypt(encryptedMasterKey, keys.concat().reverse())]);
  }
}

/**
 *
 * @param msc
 * @param text
 */
export function encryptText(msc: MasterKeySecret, text: string): string {
  return msc.encrypt(new Buffer(text, 'utf-8')).toString('base64');
}

/**
 *
 * @param msc
 * @param base64EncMK
 * @param userPassword
 */
export function decryptUserMasterKey(msc: MasterKeySecret, base64EncMK: string, userPassword: string) {
  msc.key = decrypt(new Buffer(base64EncMK, 'base64'), [
    new Buffer(userPassword, 'utf-8'),
    new Buffer(config.crypto.globalKey, 'hex')
  ]);
}

/**
 *
 * @param msc
 * @param hexEncMK
 */
export function recoveryUserMasterKey(msc: MasterKeySecret, hexEncMK: string) {
  msc.key = decrypt(new Buffer(hexEncMK, 'hex'), [new Buffer(config.crypto.recoveryKey, 'hex')]);
}

/**
 *
 * @param msc
 * @param newUserPassword
 * @param hexEncMK
 */
export function resetUserMasterKey(msc: MasterKeySecret, newUserPassword: string, hexEncMK: string) {
  recoveryUserMasterKey(msc, hexEncMK);
  return msc.getEncryptedMasterKey([
    new Buffer(newUserPassword, 'utf-8'),
    new Buffer(config.crypto.globalKey, 'hex')
  ]);
}

/**
 *
 * @param msc
 * @param userPassword
 */
export function getUserMasterKey(msc: MasterKeySecret, userPassword: string) {
  return msc.getEncryptedMasterKey([
    new Buffer(userPassword, 'utf-8'),
    new Buffer(config.crypto.globalKey, 'hex')
  ]).toString('base64');
}

/**
 *
 * @param msc
 */
export function getRecoveryMasterKey(msc: MasterKeySecret) {
  return msc.getEncryptedMasterKey([
    new Buffer(config.crypto.recoveryKey, 'hex')
  ]).toString('hex');
}

/**
 *
 * @param msc
 * @param text
 * @param userPassword
 * @param base64EncMK
 */
export function decryptTextByUserMasterKey(msc: MasterKeySecret, text: string, userPassword: string, base64EncMK: string): string {
  return msc.decrypt(new Buffer(text, 'base64'), [
    new Buffer(userPassword, 'utf-8'),
    new Buffer(config.crypto.globalKey, 'hex')
  ], new Buffer(base64EncMK, 'base64')).toString('utf-8');
}

/**
 *
 * @param msc
 * @param text
 * @param hexEncMK
 */
export function decryptTextByRecoveryMasterKey(msc: MasterKeySecret, text: string, hexEncMK: string): string {
  return msc.decrypt(new Buffer(text, 'base64'), [
    new Buffer(config.crypto.recoveryKey, 'hex')
  ], new Buffer(hexEncMK, 'hex')).toString('utf-8');
}
