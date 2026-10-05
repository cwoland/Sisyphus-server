import { asyncHandler } from '../../utils/asyncHandler.js';
import { listFriendsFeed } from './feed.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getFeed = asyncHandler(async (req, res) => {
    const { before, beforeId } = req.query;

    const valid = Boolean(before) && !Number.isNaN(Date.parse(before)) && UUID.test(beforeId || '');

    const feed = await listFriendsFeed(req.userId, {
        before: valid ? before : undefined,
        beforeId: valid ? beforeId : undefined,
    });

    res.json({ feed });
});