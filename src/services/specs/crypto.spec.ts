import * as chai from 'chai';

import { MasterKeySecret, encryptEcies, decryptEcies } from '../crypto';
import { readFileSync } from 'fs';

const { expect } = chai;

describe('Crypto MasterKeySecret', () => {
  const message = new Buffer('Hello world', 'utf-8');
  const keys = [
    new Buffer('First Secret 1'),
    new Buffer('Second Secret 2'),
  ];
  let masterKey: MasterKeySecret;
  const recoveryPubKey = new Buffer(readFileSync(__dirname + '/../../../test/reckey.hex', 'utf-8'), 'hex');
  const recoveryPrivKey = new Buffer(readFileSync(__dirname + '/../../../test/reckey-priv.hex', 'utf-8'), 'hex');

  beforeEach(() => {
    masterKey = new MasterKeySecret();
  })

  it('should encryptEcies and after decryptEcies', () => {
    const encryptedPack = encryptEcies(recoveryPubKey, message);

    expect(encryptedPack.msg.length).is.gt(0).and.is.not.equals(message.length);

    const decodedMessgage = decryptEcies(recoveryPrivKey, encryptedPack);

    expect(decodedMessgage).is.not.null;
    expect(decodedMessgage.equals(message)).is.true;
  });

  it('should fail decryptEcies with invalid key', () => {
    const encryptedPack = encryptEcies(recoveryPubKey, message);

    expect(encryptedPack.msg.length).is.gt(0).and.is.not.equals(message.length);

    const decodedMessgage = decryptEcies(Buffer.alloc(32, '1'), encryptedPack);

    expect(decodedMessgage).is.null;
  });

  it('should encrypt and after decrypt by master key', () => {
    const encodedMessage = masterKey.encrypt(message);
    expect(encodedMessage.length).is.gt(0).and.not.equals(message.length);

    const encodedMasterKey = masterKey.getEncryptedMasterKey(keys);
    expect(encodedMasterKey.length).is.gt(0);

    const masterKeyDecoder = new MasterKeySecret();
    const decodedMessage = masterKeyDecoder.decrypt(encodedMessage, keys, encodedMasterKey);
    expect(decodedMessage).is.not.null;
    expect(message.equals(decodedMessage)).is.true;
  });

  it('should not decrypt by invalid key', () => {
    const encodedMessage = masterKey.encrypt(message);
    const encodedMasterKey = masterKey.getEncryptedMasterKey(keys);
    const masterKeyDecoder = new MasterKeySecret();

    expect(masterKeyDecoder.decrypt(encodedMessage, [new Buffer('invalid')], encodedMasterKey)).is.null;
  });
});
