import * as chai from 'chai';

import { MasterKeySecret, encryptEcies, decryptEcies } from '../crypto';
import { readFileSync } from 'fs';

const { expect } = chai;

describe('Crypto MasterKeySecret', () => {
  it('should encryptEcies and after decryptEcies', () => {
    const message = new Buffer('Hello world', 'utf-8');
    const encryptedPack = encryptEcies(new Buffer(readFileSync(__dirname + '/../../../test/reckey.hex', 'utf-8'), 'hex'), message);

    expect(encryptedPack.msg.length).is.gt(0).and.is.not.equals(message.length);

    const decMsg = decryptEcies(new Buffer(readFileSync(__dirname + '/../../../test/reckey-priv.hex', 'utf-8'), 'hex'), encryptedPack);
    expect(decMsg).is.not.null;
    expect(decMsg.equals(message)).is.true;
  });

  it('should encrypt and after decrypt by multi-keys', () => {
    const message = new Buffer('Hello world', 'utf-8');
    const keys = [
      new Buffer('First Secret 1'),
      new Buffer('Second Secret 2'),
    ];
    const msEnc = new MasterKeySecret();

    const encMsg = msEnc.encrypt(message);
    expect(encMsg.length).is.gt(0).and.is.not.equals(message.length);

    const encMK = msEnc.getEncryptedMasterKey(keys);
    expect(encMK.length).is.gt(0);

    const msDec = new MasterKeySecret();
    const decMsg = msDec.decrypt(encMsg, keys, encMK);
    expect(decMsg).is.not.null;
    expect(message.equals(decMsg)).is.true;
  });
});
