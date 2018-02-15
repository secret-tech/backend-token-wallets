# Jincor PC Backend
This is backend module of Jincor token wallets dashboard: https://token-wallets.jincor.com.

It was implemented to provide following functionality:
1. users sign up.
1. Generation of Ethereum address upon user activation.
1. Token purchase.
1. Displaying User's transaction history.
1. All important actions are protected with 2FA (email or google authenticator) by integration with Jincor Backend Verify service (https://github.com/JincorTech/backend-verify)
1. For more info check API docs: https://jincortech.github.io/backend-token-wallets

## Technology stack

1. Typescript, Express, InversifyJS (DI), TypeORM (MongoDB interaction).
1. Web3JS - interaction with Ethereum client. backend supports any JSON-RPC compliant client.
1. Mocha/chai - unit/functional tests.
1. Docker.

## How to start development and run tests?

1. Clone this repo.
1. Run `docker-compose build --no-cache`.
1. Run `docker-compose up -d`.
1. Run `cp .env.test .env`.
1. To install dependencies run `docker-compose exec api npm i`.
1. Run tests `docker-compose exec api npm test`.

## How to generate docs?

1. Install aglio `npm install -g aglio`.
1. Run `mkdir /usr/local/lib/node_modules/aglio/node_modules/aglio-theme-olio/cache`.
1. Generate `aglio --theme-variables cyborg --theme-template triple -i apiary.apib -o ./docs/index.html`.
