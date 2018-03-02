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
export function getPrivateKeyByMnemonicAndSalt(mnemonic: string, salt: string, walletIndex: number = 0) {
  // get seed
  const hdWallet = hdkey.fromMasterSeed(bip39.mnemonicToSeed(mnemonic, salt));

  // get first of available wallets
  const path = 'm/44\'/60\'/0\'/0/' + Math.max(~~walletIndex, 0);

  // get wallet
  const wallet = hdWallet.derivePath(path).getWallet();

  // get private key
  return '0x' + wallet.getPrivateKey().toString('hex');
}

/**
 *
 * @param text
 */
export function getSha256Hash(text: Buffer): Buffer {
  return crypto.createHash('sha256').update(text).digest();
}

export function getSha512Hash(text: Buffer): Buffer {
  return crypto.createHash('sha512').update(text).digest();
}

export function getHmacSha256(key: Buffer, msg: Buffer): Buffer {
  return crypto.createHmac('sha256', key).update(msg).digest();
}

export function getHmacSha512(key: Buffer, msg: Buffer): Buffer {
  return crypto.createHmac('sha512', key).update(msg).digest();
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
function encryptAes256ctr(inputBuffer: Buffer, keys: Buffer[]): Buffer {
  let outBuffer: Buffer;
  keys.map((key) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-ctr', getSha256Hash(key), iv);
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
function decryptAes256ctr(inputBuffer: Buffer, keys: Buffer[]): Buffer {
  let outBuffer: Buffer;
  keys.map((key) => {
    const iv = inputBuffer.slice(0, 16);
    const decipher = crypto.createDecipheriv('aes-256-ctr', getSha256Hash(key), iv);
    outBuffer = Buffer.concat([decipher.update(inputBuffer.slice(16)), decipher.final()]);
    inputBuffer = Buffer.from(outBuffer);
  });
  return inputBuffer;
}

/**
 *
 * @param pubkeyTo
 * @param msg
 */
export function encryptEcies(pubkeyTo: Buffer, msg: Buffer): { mac: Buffer; pubkey: Buffer; msg: Buffer; } {
  const ecdh = crypto.createECDH('secp521r1');
  ecdh.generateKeys();
  const keyHash = getSha512Hash(ecdh.computeSecret(pubkeyTo));
  const ciphertext = encryptAes256ctr(msg, [keyHash.slice(0, 32)]);

  return {
    mac: getHmacSha256(keyHash.slice(32), Buffer.concat([ecdh.getPublicKey(), ciphertext])),
    pubkey: ecdh.getPublicKey(),
    msg: ciphertext
  };
}

/**
 *
 * @param privkey
 * @param encryptedPack
 */
export function decryptEcies(privkey: Buffer, encryptedPack: { mac: Buffer; pubkey: Buffer; msg: Buffer; }): Buffer {
  const ecdh = crypto.createECDH('secp521r1');
  ecdh.setPrivateKey(privkey);
  const keyHash = getSha512Hash(ecdh.computeSecret(encryptedPack.pubkey));
  const currentHmac = getHmacSha256(keyHash.slice(32), Buffer.concat([encryptedPack.pubkey, encryptedPack.msg]));

  if (!currentHmac.equals(encryptedPack.mac)) {
    return null;
  }

  return decryptAes256ctr(encryptedPack.msg, [keyHash.slice(0, 32)]);
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
    this.key = crypto.randomBytes(32);
  }

  /**
   *
   * @param keys
   */
  getEncryptedMasterKey(keys: Buffer[]): Buffer {
    return encryptAes256ctr(this.key, keys);
  }

  /**
   *
   * @param inputBuffer
   */
  encrypt(inputBuffer: Buffer): Buffer {
    const encryptedData = encryptAes256ctr(inputBuffer, [this.key]);
    return Buffer.concat([
      getHmacSha256(this.key, encryptedData),
      encryptedData
    ]);
  }

  /**
   *
   * @param inputBuffer
   * @param keys
   * @param encryptedMasterKey
   */
  decrypt(inputBuffer: Buffer, keys: Buffer[], encryptedMasterKey: Buffer): Buffer {
    const mac = inputBuffer.slice(0, 32);

    const data = inputBuffer.slice(32);
    if (!data.length) {
      return null;
    }

    const masterKey = decryptAes256ctr(encryptedMasterKey, keys.concat().reverse());
    if (!getHmacSha256(masterKey, data).equals(mac)) {
      return null;
    }
    return decryptAes256ctr(data, [masterKey]);
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
  msc.key = decryptAes256ctr(new Buffer(base64EncMK, 'base64'), [
    new Buffer(userPassword, 'utf-8'),
    new Buffer(config.crypto.globalKey, 'hex')
  ].reverse());
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
  return encryptEcies(new Buffer(config.crypto.recoveryKey, 'hex'), msc.getEncryptedMasterKey([]));
}

/**
 *
 * @param msc
 * @param text
 * @param userPassword
 * @param base64EncMK
 */
export function decryptTextByUserMasterKey(msc: MasterKeySecret, text: string, userPassword: string, base64EncMK: string): string {
  const data = msc.decrypt(new Buffer(text, 'base64'), [
    new Buffer(userPassword, 'utf-8'),
    new Buffer(config.crypto.globalKey, 'hex')
  ], new Buffer(base64EncMK, 'base64'))
  return data && data.toString('utf-8') || null;
}
