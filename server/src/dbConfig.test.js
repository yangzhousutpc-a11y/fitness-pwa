import assert from 'node:assert/strict';
import test from 'node:test';
import { createDbConfig } from './dbConfig.js';

test('creates mysql config from WeChat CloudRun template variables', () => {
  const config = createDbConfig({
    MYSQL_ADDRESS: '10.27.101.182:3306',
    MYSQL_USERNAME: 'root',
    MYSQL_PASSWORD: 'secret',
    MYSQL_DATABASE: 'jianshen',
  });

  assert.equal(config.host, '10.27.101.182');
  assert.equal(config.port, 3306);
  assert.equal(config.user, 'root');
  assert.equal(config.password, 'secret');
  assert.equal(config.database, 'jianshen');
});

test('keeps standard mysql env names as the primary option', () => {
  const config = createDbConfig({
    MYSQL_HOST: 'db.internal',
    MYSQL_PORT: '3307',
    MYSQL_USER: 'app',
    MYSQL_PASSWORD: 'secret',
  });

  assert.equal(config.host, 'db.internal');
  assert.equal(config.port, 3307);
  assert.equal(config.user, 'app');
  assert.equal(config.database, 'jianshen');
});
