import * as fs from 'fs';

require('dotenv').config();

const {
  LOGGING_LEVEL,
  LOGGING_FORMAT,
  LOGGING_COLORIZE,

  HTTP_IP,
  HTTP_PORT,

  ENVIRONMENT,
  APP_API_PREFIX_URL,
  APP_FRONTEND_PREFIX_URL,

  THROTTLER_WHITE_LIST,
  THROTTLER_INTERVAL,
  THROTTLER_MAX,
  THROTTLER_MIN_DIFF,

  NSQ_HOST,
  NSQ_PORT,

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

  METRICS_AUTH_USERNAME,
  METRICS_AUTH_PASSWORD,

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
    env: ENVIRONMENT || 'local',
    frontendPrefixUrl: APP_FRONTEND_PREFIX_URL || 'http://token-wallets',
    backendPrefixUrl: APP_API_PREFIX_URL || 'http://api.token-wallets'
  },
  nsqd: {
    host: NSQ_HOST || 'nsqd',
    port: parseInt(NSQ_HOST, 10) || 4150
  },
  server: {
    httpPort: parseInt(HTTP_PORT, 10) || 3000,
    httpIp: HTTP_IP || '0.0.0.0'
  },
  web3: {
    startBlock: WEB3_RESTORE_START_BLOCK || 0,
    defaultInvestGas: '130000'
  },
  redis: {
    url: REDIS_URL || 'redis://redis:6379',
    prefix: 'jcbtw_'
  },
  throttler: {
    prefix: 'request_throttler_',
    interval: THROTTLER_INTERVAL || 1000,
    maxInInterval: THROTTLER_MAX || 2,
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
  metrics: {
    authUsername: METRICS_AUTH_USERNAME || 'metrics',
    authPassword: METRICS_AUTH_PASSWORD || 'metrics'
  },
  email: {
    domain: 'jincor.com',
    from: {
      general: 'noreply@jincor.com',
      referral: 'partners@jincor.com'
    }
  },
  contracts: {
    erc20Token: {
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
