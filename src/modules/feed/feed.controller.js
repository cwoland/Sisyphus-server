import { asyncHandler } from '../../utils/asyncHandler.js';
import { listFriendsFeed } from './feed.service.js';

export const getFeed = asyncHandler(async (req, res) => {
    const feed = await listFriendsFeed(req.userId, { before: req.query.before });
    res.json({ feed });
});