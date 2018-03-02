const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const assert = require('assert');
const MongoClient = require('mongodb').MongoClient;
const lib = require('./cryptolib');
const argv = require('yargs')
  .usage('Usage: $0 [options]')

  .alias('m', 'mongo-url')
  .nargs('m', 1)
  .describe('m', 'Mongo connection url')

  .alias('p', 'rec-key')
  .nargs('p', 1)
  .describe('p', 'Recovery private key file in hex')

  .alias('g', 'glob-key')
  .nargs('g', 1)
  .describe('g', 'Global key file in hex')

  .alias('e', 'user-email')
  .nargs('e', 1)
  .describe('e', 'User email')

  .alias('f', 'force-password')
  .nargs('f', 1)
  .describe('f', 'Force password instead of random')

  .demandOption(['m', 'p', 'g', 'e'])
  .help('h')
  .alias('h', 'help')
  .argv;

const globKey = Buffer.from(fs.readFileSync(argv.g, 'utf-8'), 'hex');
const recPrivKey = Buffer.from(fs.readFileSync(argv.p, 'utf-8'), 'hex');

console.log('Connection to mogno...');

let connection, db;
MongoClient.connect(argv.m).then((client) => {
  connection = client;
  db = connection.db(argv.m.slice(argv.m.lastIndexOf('/') + 1));
})
.then(() => {
  return db.collection('user').findOne({
    email: argv.e.toLowerCase()
  });
})
.then((u) => {
  if (!u) {
    throw new Error('User not found');
  }

  if (!u.recoveryKey) {
    throw new Error('No recoveryKey found');
  }

  // find recovery key file for user
  const userRecName = lib.getSha256Hash(Buffer.from(u.email + argv.a.toLowerCase()), 'utf-8').toString('hex');
  console.log('Try to decode recovery key by recovery key file', userRecName);

  const recKeyRaw = JSON.parse(u.recoveryKey);

  const mk = new lib.MasterKeySecret();

  const recKey = {
    mac: mk.decrypt(Buffer.from(recKeyRaw.mac, 'base64'), [], globKey),
    pubkey: mk.decrypt(Buffer.from(recKeyRaw.pubkey, 'base64'), [], globKey),
    msg: mk.decrypt(Buffer.from(recKeyRaw.msg, 'base64'), [], globKey)
  };

  if (!recKey.mac || !recKey.pubkey || !recKey.msg) {
    throw new Error(`Some field is damaged: mac=${recKey.mac} pubkey=${recKey.pubkey} msg=${recKey.msg}`);
  }

  recKey.mac = recKey.mac.toString('base64');
  recKey.msg = recKey.msg.toString('base64');
  recKey.pubkey = recKey.pubkey.toString('base64');

  // decrypt by private key
  console.log('Try decrypt master key');

  const mkRaw = lib.decryptEcies(recPrivKey, {
    mac: Buffer.from(recKey.mac, 'base64'),
    pubkey: Buffer.from(recKey.pubkey, 'base64'),
    msg: Buffer.from(recKey.msg, 'base64')
  });

  if (!mkRaw) {
    throw new Error('Master key cannot decode from this file, maybe this is not related for this user!?');
  }

  // generate random password
  const newPassword = '' + (argv.f || crypto.randomBytes(32).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 14));

  // generate new encrypted key for user
  mk.key = mkRaw;
  const newMasterKey = mk.getEncryptedMasterKey([
    new Buffer(newPassword, 'utf-8'),
    globKey
  ]).toString('base64');

  // update user wallets securityKey with new encrypted key
  console.log('Try to reset security key', newMasterKey.toString('base64'), 'by password', newPassword);

  if (!u.wallets.filter(w => w.address === argv.a).length) {
    throw new Error('Hmm, I cant find user wallet (but mongo it does)');
  }

  return db.collection('user').updateOne({
    email: argv.e
  }, { $set: {
    'securityKey': newMasterKey.toString('base64'),
  }});
})
.then((result) => {
  console.log('Is modified?', !!result.result.nModified);
  connection.close();
}, (err) => {
  connection && connection.close();
  console.log('Error was occurred', err);
});
