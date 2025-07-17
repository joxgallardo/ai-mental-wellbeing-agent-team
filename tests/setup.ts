// Configure test environment
process.env['NODE_ENV'] = 'test';

// Mock environment variables for tests
process.env['OPENAI_API_KEY'] = 'test-openai-key';
process.env['SUPABASE_URL'] = 'https://test.supabase.co';
process.env['SUPABASE_ANON_KEY'] = 'test-anon-key';
process.env['SUPABASE_SERVICE_KEY'] = 'test-service-key';
process.env['TELEGRAM_BOT_TOKEN'] = 'test-bot-token';
process.env['RAG_ENABLED'] = 'true';
process.env['HYBRID_SEARCH_ENABLED'] = 'true';
process.env['EMBEDDING_MODEL'] = 'sentence-transformers/all-MiniLM-L6-v2';
process.env['LOGGING_LEVEL'] = 'info';
process.env['LOGGING_FORMAT'] = 'json';
process.env['FEATURE_FLAG_ENABLED'] = 'true';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';
process.env['REDIS_URL'] = 'redis://localhost:6379';
process.env['PORT'] = '3000';

// Mock file system operations
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  existsSync: jest.fn(),
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
  },
}));

// Mock path operations
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  join: jest.fn((...args) => args.join('/')),
  dirname: jest.fn((path) => path.split('/').slice(0, -1).join('/')),
}));

// Mock Supabase client with complete chaining support
const createMockSupabaseClient = () => {
  const mockChain: any = {
    select: jest.fn(() => mockChain),
    eq: jest.fn(() => mockChain),
    neq: jest.fn(() => mockChain),
    gt: jest.fn(() => mockChain),
    gte: jest.fn(() => mockChain),
    lt: jest.fn(() => mockChain),
    lte: jest.fn(() => mockChain),
    like: jest.fn(() => mockChain),
    ilike: jest.fn(() => mockChain),
    is: jest.fn(() => mockChain),
    in: jest.fn(() => mockChain),
    contains: jest.fn(() => mockChain),
    containedBy: jest.fn(() => mockChain),
    rangegt: jest.fn(() => mockChain),
    rangegte: jest.fn(() => mockChain),
    rangelt: jest.fn(() => mockChain),
    rangelts: jest.fn(() => mockChain),
    rangeadjacent: jest.fn(() => mockChain),
    overlaps: jest.fn(() => mockChain),
    textSearch: jest.fn(() => mockChain),
    match: jest.fn(() => mockChain),
    not: jest.fn(() => mockChain),
    or: jest.fn(() => mockChain),
    filter: jest.fn(() => mockChain),
    order: jest.fn(() => mockChain),
    limit: jest.fn(() => mockChain),
    range: jest.fn(() => mockChain),
    single: jest.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
    then: jest.fn((callback) => Promise.resolve({ data: [], error: null }).then(callback)),
    catch: jest.fn((callback) => Promise.resolve({ data: [], error: null }).catch(callback)),
    data: [],
    error: null,
  };

  return {
    from: jest.fn(() => ({
      ...mockChain,
      insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
      update: jest.fn(() => Promise.resolve({ data: null, error: null })),
      delete: jest.fn(() => Promise.resolve({ data: null, error: null })),
      upsert: jest.fn(() => Promise.resolve({ data: null, error: null })),
    })),
    rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
    auth: {
      signInWithPassword: jest.fn(() => Promise.resolve({ data: null, error: null })),
      signOut: jest.fn(() => Promise.resolve({ error: null })),
      getSession: jest.fn(() => Promise.resolve({ data: null, error: null })),
      getUser: jest.fn(() => Promise.resolve({ data: null, error: null })),
    },
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(() => Promise.resolve({ data: null, error: null })),
        download: jest.fn(() => Promise.resolve({ data: null, error: null })),
        remove: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    },
  };
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => createMockSupabaseClient()),
}));

// Mock @xenova/transformers
jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn(() => Promise.resolve({
    encode: jest.fn(() => Promise.resolve([0.1, 0.2, 0.3])),
  })),
}));

// Mock js-yaml
jest.mock('js-yaml', () => ({
  load: jest.fn((content) => {
    if (typeof content === 'string' && content.includes('name:')) {
      return { name: 'test-domain', display_name: 'Test Domain' };
    }
    return {};
  }),
  dump: jest.fn((obj) => JSON.stringify(obj)),
}));

// Mock Winston to prevent file path issues
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  })),
  format: {
    combine: jest.fn(() => ({})),
    timestamp: jest.fn(() => ({})),
    json: jest.fn(() => ({})),
    colorize: jest.fn(() => ({})),
    printf: jest.fn(() => ({})),
  },
  transports: {
    Console: jest.fn(() => ({})),
    File: jest.fn(() => ({})),
  },
}));

// Mock logger utility with comprehensive path coverage
const createMockLogger = (name: string): any => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  log: jest.fn(),
  child: jest.fn(() => createMockLogger(`${name}-child`)),
});

// Mock all possible logger paths
jest.mock('../src/utils/logger', () => ({
  createLogger: jest.fn((name) => createMockLogger(name)),
  logger: createMockLogger('default'),
}));

// Additional path variations for different test locations
jest.mock('../../src/utils/logger', () => ({
  createLogger: jest.fn((name) => createMockLogger(name)),
  logger: createMockLogger('default'),
}));

jest.mock('../../../src/utils/logger', () => ({
  createLogger: jest.fn((name) => createMockLogger(name)),
  logger: createMockLogger('default'),
}));

// Suppress console logs during tests unless explicitly needed
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Suppress console output during tests
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  // Restore console output
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Global test timeout
jest.setTimeout(10000);

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Cleanup function for after each test
afterEach(() => {
  // Clear all timers
  jest.clearAllTimers();
  
  // Clear all mocks
  jest.clearAllMocks();
});

// Global teardown
afterAll(async () => {
  // Wait a bit for any pending operations to complete
  await new Promise(resolve => setTimeout(resolve, 100));
}); 