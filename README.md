# Moon Wallet Backend module
[![Build Status](https://travis-ci.org/secret-tech/backend-token-wallets.svg?branch=master)](https://travis-ci.org/secret-tech/backend-token-wallets)

This is backend module of [Moon Wallet](https://moonwallet.tech/) backed with
:heart: and :coffee: for the crypto community by [secret_tech](https://secrettech.io)


![Moon Wallet](https://monosnap.com/file/AWvzmQe6IvNezvjIhYwkSDWbiKB5en.png)

> This backend module can be used to build a typical ETH and ERC-20 tokens
wallet. Currently it has the following functionality

1. Registration & Authorization
1. Register any Token by specified contract address
1. Generate and manage **multiple** Ethereum wallets by one account
1. Transfer ETH / ERC-20 
1. Transferring is protected by payment password
1. Displaying transaction history for ETH/ERC-20
1. Notification management
1. All important actions are protected with 2FA (email or google authenticator) 
by integration with 
[Jincor Backend Verify](https://github.com/JincorTech/backend-verify) 
   You can disable some kind of verifications as well.


For more info check [**API DOCS**](https://jincortech.github.io/backend-token-wallets)

![Moon Wallet Screenshot](https://monosnap.com/file/ju7HjvPDg0csEeInRo11JrudDAJDc3.png)

## Technology stack

1. Typescript, Express, InversifyJS (DI), Mongoose
1. Web3JS - interaction with Ethereum client. 
    _Backend supports any JSON-RPC compliant client. For development
    and testing purpose you can use [Infura.io](https://infura.io)_
1. Mocha/chai - unit/functional tests
1. [Jincor Backend Verify](https://github.com/JincorTech/backend-verify) -
 all kind of verifications
1. [Jincor Backend Auth](https://github.com/JincorTech/backend-auth) - 
 all kind of Authorization
1. [secrettech Backend Notify](https://github.com/JincorTech/backend-notify) - 
 notifications
1. Docker

## Changelog
**Closed issues**

- Fix wallets creation [\#47](https://github.com/JincorTech/backend-token-wallets/issues/47)
- Payments add gas limit settings [\#38](https://github.com/JincorTech/backend-token-wallets/issues/38)
- Preferences: add an ability to disable 2FA [\#35](https://github.com/JincorTech/backend-token-wallets/issues/35)
- Preferences: changing password for the same should fail [\#34](https://github.com/JincorTech/backend-token-wallets/issues/34)
- Preferences: save email notification settings [\#33](https://github.com/JincorTech/backend-token-wallets/issues/33)
- Sending: address check is case-sensetive [\#29](https://github.com/JincorTech/backend-token-wallets/issues/29)
- Registration: email check is case-sensetive [\#28](https://github.com/JincorTech/backend-token-wallets/issues/28)
- Add ability to control notifications and verifications  [\#19](https://github.com/JincorTech/backend-token-wallets/issues/19)
- Add ability to retrieve all transactions for wallets. [\#16](https://github.com/JincorTech/backend-token-wallets/issues/16)
- Add tests [\#12](https://github.com/JincorTech/backend-token-wallets/issues/12)
- Ability to store encrypted privateKey in this service  [\#11](https://github.com/JincorTech/backend-token-wallets/issues/11)
- Fix emails [\#10](https://github.com/JincorTech/backend-token-wallets/issues/10)
- Work with set of tokens [\#9](https://github.com/JincorTech/backend-token-wallets/issues/9)
- Add documentation. [\#8](https://github.com/JincorTech/backend-token-wallets/issues/8)
- Add integration with backend-notify [\#5](https://github.com/JincorTech/backend-token-wallets/issues/5)
- Implement methods for sending eth and any erc20  [\#3](https://github.com/JincorTech/backend-token-wallets/issues/3)
- Test any smart contract [\#2](https://github.com/JincorTech/backend-token-wallets/issues/2)
- First project adaptation [\#1](https://github.com/JincorTech/backend-token-wallets/issues/1)

Full changelog available [**here**](/CHANGELOG.md)

## How to start development and run tests?

1. Clone this repo.
1. Run `$ docker-compose -f docker-compose.test.yml build --no-cache`
1. Run `$ docker-compose -f docker-compose.test.yml run api /bin/sh`
1. To install dependencies run `$ npm i`
1. Run tests watch mode `$ npm run start:test`

## Contributing
Contributions are appreciated. If you found any bugs or in trouble with
installing or running this module, feel free to open new issues.

Contributing guideline can be found [**here**](/CONTRIBUTING.md)

## How to generate API docs?

1. Modify apiary.apib to match  your API
1. Install aglio `npm install -g aglio`
1. Run `mkdir /usr/local/lib/node_modules/aglio/node_modules/aglio-theme-olio/cache`
1. Generate `aglio --theme-variables cyborg --theme-template triple -i apiary.apib -o ./docs/index.html`

## License
Apache 2.0 license

[More details](https://github.com/JincorTech/backend-token-wallets/blob/develop/LICENSE)
