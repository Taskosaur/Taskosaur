import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  environment: process.env.NODE_ENV || 'development',
  cors: {
    origin: process.env.CORS_ORIGIN === '*' ? true : process.env.CORS_ORIGIN || true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
  swagger: {
    title: 'Taskosaur API',
    description: 'A comprehensive project management API similar to Jira, Asana, and Monday.com',
    version: '1.0.0',
    path: 'api/docs',
  },
}));
