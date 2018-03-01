# Jincor Backend Wallets
This is backend module of Jincor token wallets: https://token-wallets.jincor.com.

It was implemented to provide following functionality:
1. Register a user.
1. Register any Token by specified contract address.
1. Generate of Ethereum wallet.
1. Transfer ethers / tokens, transfering is protected by payment password.
1. Displaying transaction history, tokens included.
1. Enable or disable notifications.
1. All important actions are protected with 2FA (email or google authenticator) by integration with Jincor Backend Verify service (https://github.com/JincorTech/backend-verify)
   You can disable some kind of verifications.
1. For more info check API docs: https://jincortech.github.io/backend-token-wallets

## Technology stack

1. Typescript, Express, InversifyJS (DI), Mongoose.
1. Web3JS - interaction with Ethereum client. backend supports any JSON-RPC compliant client.
1. Mocha/chai - unit/functional tests.
1. Docker.

## How to start development and run tests?

1. Clone this repo.
1. Run `$ docker-compose -f docker-compose.test.yml build --no-cache`.
1. Run `$ docker-compose -f docker-compose.test.yml run api /bin/sh`.
1. To install dependencies run `$ npm i`.
1. Run tests watch mode `$ npm run start:test`.

## How to generate docs?

1. Install aglio `npm install -g aglio`.
1. Run `mkdir /usr/local/lib/node_modules/aglio/node_modules/aglio-theme-olio/cache`.
1. Generate `aglio --theme-variables cyborg --theme-template triple -i apiary.apib -o ./docs/index.html`.
