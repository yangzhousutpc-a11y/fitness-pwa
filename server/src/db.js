import 'dotenv/config';
import mysql from 'mysql2/promise';
import { createDbConfig } from './dbConfig.js';

export const pool = mysql.createPool(createDbConfig());
