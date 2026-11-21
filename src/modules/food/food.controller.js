import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/apiError.js';
import { z } from 'zod';
import { searchFood, getFoodByBarcode, getFoodChoices } from './food.service.js';

const BARCODE = /^[0-9]{6,14}$/;

export const getFoodPicker = asyncHandler(async (req, res) => {
  const term = z.string().trim().max(200).default('').parse(req.query.q);
  res.json({ products: await getFoodChoices(req.userId, term) });
});

export const getFoodSearch = asyncHandler(async (req, res) => {
  const products = await searchFood(req.query.q);
  res.json({ products });
});

export const getFoodProduct = asyncHandler(async (req, res) => {
  const { barcode } = req.params;
  if (!BARCODE.test(barcode)) throw new ApiError(400, 'Некорректный штрихкод');

  const product = await getFoodByBarcode(barcode);
  if (!product) throw new ApiError(404, 'Продукт не найден');

  res.json({ product });
});
