function splitAddress(address) {
  if (!address) {
    return {};
  }

  const [host, port] = address.split(':');
  return { host, port };
}

export function createDbConfig(env = process.env) {
  const address = splitAddress(env.MYSQL_ADDRESS);

  return {
    host: env.MYSQL_HOST ?? address.host,
    port: Number(env.MYSQL_PORT ?? address.port ?? 3306),
    user: env.MYSQL_USER ?? env.MYSQL_USERNAME,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE ?? 'jianshen',
    waitForConnections: true,
    connectionLimit: 10,
  };
}
