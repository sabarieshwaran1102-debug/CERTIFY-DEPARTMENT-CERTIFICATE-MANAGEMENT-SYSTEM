/**
 * Wraps async route handlers to catch errors and pass them to next()
 * Usage: router.get('/', asyncHandler(async (req, res, next) => { ... }))
 */
export const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
