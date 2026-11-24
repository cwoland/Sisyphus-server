import express from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/apiError.js';
import { env } from '../../config/env.js';

const bucket = 'progress-photos';
const pageSize = 6;
const namePattern = /^\d{4}-\d{2}-\d{2}_[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}\.jpg$/;

async function storage(path, options = {}) {
  if (!env.supabaseUrl || !env.storageKey) throw new ApiError(503, 'Фотографии пока не настроены');
  const response = await fetch(env.supabaseUrl.replace(/\/$/, '') + '/storage/v1/' + path, {
    ...options,
    headers: { apikey: env.storageKey, Authorization: 'Bearer ' + env.storageKey, ...options.headers },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (response.status === 404 || Number(error.statusCode) === 404) throw new ApiError(404, 'Файл или хранилище не найдено');
    throw new ApiError(502, 'Хранилище фотографий временно недоступно');
  }
  return response;
}

function keyFor(req) {
  const name = z.string().regex(namePattern).parse(req.params.name);
  z.iso.date().parse(name.slice(0, 10));
  return req.userId + '/' + name;
}

const json = (method, body) => ({
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

const router = express.Router();
router.use((_req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
});

router.get('/', asyncHandler(async (req, res) => {
  const page = z.coerce.number().int().min(0).max(100000).parse(req.query.page ?? 0);
  const response = await storage('object/list/' + bucket, json('POST', {
    prefix: req.userId, limit: pageSize + 1, offset: page * pageSize,
    sortBy: { column: 'name', order: 'desc' },
  }));
  const items = await response.json();
  res.json({ names: items.slice(0, pageSize).map((p) => p.name).filter((n) => namePattern.test(n)),
    hasNext: items.length > pageSize });
}));

router.put('/:name', express.raw({ type: 'image/jpeg', limit: '2mb' }), asyncHandler(async (req, res) => {
  const key = keyFor(req);
  const file = req.body;
  if (!Buffer.isBuffer(file) || file.length < 4 || file.readUInt16BE(0) !== 0xffd8 ||
      file.readUInt16BE(file.length - 2) !== 0xffd9) throw new ApiError(415, 'Ожидается изображение JPEG');
  const config = await (await storage('bucket/' + bucket)).json();
  if (config.public !== false) throw new ApiError(503, 'Для фотографий требуется приватное хранилище');
  await storage('object/' + bucket + '/' + key, {
    method: 'POST', headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'true' }, body: file,
  });
  res.status(204).end();
}));

router.get('/:name', asyncHandler(async (req, res) => {
  const response = await storage('object/authenticated/' + bucket + '/' + keyFor(req));
  res.type('image/jpeg').send(Buffer.from(await response.arrayBuffer()));
}));

router.delete('/:name', asyncHandler(async (req, res) => {
  await storage('object/' + bucket, json('DELETE', { prefixes: [keyFor(req)] }));
  res.status(204).end();
}));

export default router;
