const crypto = require('crypto');

/**
 *
 * @param text
 */
function getSha256Hash(text) {
  return crypto.createHash('sha256').update(text).digest();
}

function getSha512Hash(text) {
  return crypto.createHash('sha512').update(text).digest();
}

function getHmacSha256(key, msg) {
  return crypto.createHmac('sha256', key).update(msg).digest();
}

function getHmacSha512(key, msg) {
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
function encryptAes256ctr(inputBuffer, keys) {
  let outBuffer;
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
function decryptAes256ctr(inputBuffer, keys) {
  let outBuffer;
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
function encryptEcies(pubkeyTo, msg) {
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
function decryptEcies(privkey, encryptedPack) {
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
class MasterKeySecret {
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
  getEncryptedMasterKey(keys) {
    return encryptAes256ctr(this.key, keys);
  }

  /**
   *
   * @param inputBuffer
   */
  encrypt(inputBuffer) {
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
  decrypt(inputBuffer, keys, encryptedMasterKey) {
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
function encryptText(msc, text) {
  return msc.encrypt(new Buffer(text, 'utf-8')).toString('base64');
}

/**
 *
 * @param msc
 * @param base64EncMK
 * @param userPassword
 */
function decryptUserMasterKey(msc, base64EncMK, userPassword) {
  msc.key = decryptAes256ctr(new Buffer(base64EncMK, 'base64'), [
    new Buffer(userPassword, 'utf-8'),
    new Buffer(globalKey, 'hex')
  ].reverse());
}

/**
 *
 * @param msc
 * @param userPassword
 */
function getUserMasterKey(msc, userPassword) {
  return msc.getEncryptedMasterKey([
    new Buffer(userPassword, 'utf-8'),
    new Buffer(globalKey, 'hex')
  ]).toString('base64');
}

/**
 *
 * @param msc
 */
function getRecoveryMasterKey(msc) {
  return encryptEcies(new Buffer(recoveryKey, 'hex'), msc.getEncryptedMasterKey([]));
}

function decryptRecoveryMasterKey(msc, encPack) {
  return decryptEcies(recoveryPrivKey, encPack);
}

/**
 *
 * @param msc
 * @param text
 * @param userPassword
 * @param base64EncMK
 */
function decryptTextByUserMasterKey(msc, text, userPassword, base64EncMK) {
  const data = msc.decrypt(new Buffer(text, 'base64'), [
    new Buffer(userPassword, 'utf-8'),
    new Buffer(globalKey, 'hex')
  ], new Buffer(base64EncMK, 'base64'))
  return data && data.toString('utf-8') || null;
}

module.exports = {
  MasterKeySecret,

  getSha256Hash,
  getSha512Hash,
  getHmacSha256,
  getHmacSha512,
  encryptAes256ctr,
  decryptAes256ctr,
  encryptEcies,
  decryptEcies,
  encryptText,
  decryptUserMasterKey,
  getUserMasterKey,
  getRecoveryMasterKey,
  decryptRecoveryMasterKey,
  decryptTextByUserMasterKey,
};
