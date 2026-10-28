import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/apiError.js';
import { listFriendsFeed, addReaction, removeReaction } from './feed.service.js';

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

const reactionTarget = (req) => {
    const { type, id } = req.params;
    if (!UUID.test(id)) throw new ApiError(400, 'Некорректный идентификатор');
    return { type, id };
};

export const postReaction = asyncHandler(async (req, res) => {
    const { type, id } = reactionTarget(req);
    const reaction = await addReaction(req.userId, type, id, req.body?.kind);
    res.json(reaction);
});

export const deleteReaction = asyncHandler(async (req, res) => {
    const { type, id } = reactionTarget(req);
    await removeReaction(req.userId, type, id);
    res.status(204).send();
});
