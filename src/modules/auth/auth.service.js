import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import {query } from '../../config/db.js';
import { env } from '../../config/env.js';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 30;

export const hashPassword = (password) => bcrypt.hash(password, 12);
export const comparePassword = (password, hash) => bcrypt.compare(password, hash);

export const generateAccessToken = (userId) =>
    jwt.sign({ sub: userId }, env.jwtAccessSecret, { expiresIn: ACCESS_TOKEN_TTL });

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export const generateRefreshToken = async (userId) => {
    const rawToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
        [userId, tokenHash, expiresAt]
    );

    return rawToken;
};

export const verifyRefreshToken = async (rawToken) => {
    const tokenHash = hashToken(rawToken);
    const { rows } = await query(
        `SELECT * FROM refresh_tokens WHERE token_hash = $1 AND expires_at > now()`,
        [tokenHash]
    );
    return rows[0] || null;
};

export const revokeRefreshToken = async (rawToken) => {
    const tokenHash = hashToken(rawToken);
    await query(`DELETE FROM refresh_tokens WHERE token_hash = $1`, [tokenHash]);
};

export const isUsernameTaken = async (username) => {
    const { rows } = await query(
        `SELECT 1 FROM users WHERE lower(username) = lower($1) LIMIT 1`,
        [username]
    );
    return rows.length > 0;
};

export const createUser = async ({ email, password, name, username }) => {
    const passwordHash = await hashPassword(password);
    const { rows } = await query(
        `INSERT INTO users (email, password_hash, name, username)
        VALUES ($1, $2, $3, $4)
        RETURNING id, email, name, username, avatar_url, created_at`,
        [email.toLowerCase(), passwordHash, name, username.toLowerCase()]
    );
    return rows[0];
};

export const findUserByEmail = async (email) => {
    const { rows } = await query(`SELECT * FROM users WHERE email = $1`, [email.toLowerCase()]);
    return rows[0] || null;
};

export const findUserById = async (id) => {
    const { rows } = await query(
        `SELECT id, email, name, username, avatar_url, settings, created_at FROM users WHERE id = $1`,
        [id]
    );
    return rows[0] || null;
};