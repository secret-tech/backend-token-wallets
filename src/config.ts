import * as fs from 'fs';

require('dotenv').config();

const {
  LOGGING_LEVEL,
  LOGGING_FORMAT,
  LOGGING_COLORIZE,

  HTTP_IP,
  HTTP_PORT,

  APP_API_PREFIX_URL,
  APP_FRONTEND_PREFIX_URL,

  THROTTLER_WHITE_LIST,
  THROTTLER_INTERVAL,
  THROTTLER_MAX,
  THROTTLER_MIN_DIFF,

  REDIS_URL,

  MONGO_URL,

  ORM_ENTITIES_DIR,
  ORM_SUBSCRIBER_DIR,
  ORM_MIGRATIONS_DIR,

  AUTH_VERIFY_URL,
  AUTH_ACCESS_JWT,
  AUTH_TIMEOUT,

  VERIFY_BASE_URL,
  VERIFY_TIMEOUT,

  ICO_SC_ADDRESS,
  ICO_SC_ABI_FILEPATH,

  WHITELIST_SC_ADDRESS,
  WHITELIST_SC_FILEPATH,
  WHITELIST_OWNER_PK_FILEPATH,

  ERC20_TOKEN_ADDRESS,
  ERC20_TOKEN_ABI_FILEPATH,

  RPC_TYPE,
  RPC_ADDRESS,

  WEB3_RESTORE_START_BLOCK
} = process.env;

export default {
  logging: {
    level: LOGGING_LEVEL || 'warn',
    format: LOGGING_FORMAT,
    colorize: LOGGING_COLORIZE === 'true'
  },
  app: {
    frontendPrefixUrl: APP_FRONTEND_PREFIX_URL || 'http://token-wallets',
    backendPrefixUrl: APP_API_PREFIX_URL || 'http://api.token-wallets'
  },
  server: {
    httpPort: parseInt(HTTP_PORT, 10) || 3000,
    httpIp: HTTP_IP || '0.0.0.0'
  },
  web3: {
    startBlock: WEB3_RESTORE_START_BLOCK || 2518767,
    defaultInvestGas: '130000'
  },
  redis: {
    url: REDIS_URL || 'redis://redis:6379',
    prefix: 'jincor_ico_dashboard_'
  },
  throttler: {
    prefix: 'request_throttler_',
    interval: THROTTLER_INTERVAL || 1000,
    maxInInterval: THROTTLER_MAX || 5,
    minDifference: THROTTLER_MIN_DIFF || 0,
    whiteList: THROTTLER_WHITE_LIST ? THROTTLER_WHITE_LIST.split(',') : []
  },
  auth: {
    baseUrl: AUTH_VERIFY_URL || 'http://auth:3000',
    token: AUTH_ACCESS_JWT
  },
  verify: {
    baseUrl: VERIFY_BASE_URL || 'http://verify:3000',
    maxAttempts: 3
  },
  email: {
    domain: 'jincor.com',
    from: {
      general: 'noreply@jincor.com',
      referral: 'partners@jincor.com'
    }
  },
  contracts: {
    whiteList: {
      address: WHITELIST_SC_ADDRESS,
      abi: WHITELIST_SC_ADDRESS && JSON.parse(fs.readFileSync(WHITELIST_SC_FILEPATH).toString()) || [],
      ownerPk: WHITELIST_SC_ADDRESS && fs.readFileSync(WHITELIST_OWNER_PK_FILEPATH).toString()
    },
    ico: {
      address: ICO_SC_ADDRESS,
      abi: ICO_SC_ADDRESS && JSON.parse(fs.readFileSync(ICO_SC_ABI_FILEPATH).toString()) || []
    },
    erc20Token: {
      address: ERC20_TOKEN_ADDRESS,
      abi: JSON.parse(fs.readFileSync(ERC20_TOKEN_ABI_FILEPATH).toString())
    }
  },
  typeOrm: {
    type: 'mongodb',
    synchronize: true,
    connectTimeoutMS: 2000,
    logging: LOGGING_LEVEL,
    url: MONGO_URL,
    entities: [
      ORM_ENTITIES_DIR
    ],
    migrations: [
      ORM_MIGRATIONS_DIR
    ],
    subscribers: [
      ORM_SUBSCRIBER_DIR
    ]
  },
  rpc: {
    type: RPC_TYPE,
    address: RPC_ADDRESS,
    reconnectTimeout: 2000 // in milliseconds
  }
};
