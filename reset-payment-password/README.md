Reset Payment Password CLI
===========================

Prepare
--------

Before reset password you need to prepare:

1. You have got the *GlobalKey* in hex format (256 bit)
1. You have got *Recovery Private Key* in hex format (generated with using of [NodeJS/api/crypto](https://nodejs.org/api/crypto.html#crypto_class_ecdh) **secp521r1**).
1. You installed packages `$ npm install`


Reset password
---------------

To reset a payment password for concrete user, you need *Email* and any *Wallet Address* of user (to prove attempt).

Command:
```
node index.js \
  -e 'user.email.for.reset.payment.password@gmail.com' \
  -a '0x12aA4e0f0d5C984599407e2031052Fb9b0f6B277' \
  -g ./GlobalKey.hex \
  -p ./RecoverKey-private.hex \
  -m 'mongodb://User:UserPassword@Host:OptionalPort/DataBaseName'
```

> A random password was generated, if you need to specify not random but 
> concrete password, you can use `-f 12345678` to force *12345678* as reset password.
