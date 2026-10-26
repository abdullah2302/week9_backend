// Catches any route that doesn't match.
export function notFound(req, res, next) {
    res.status(404);
    next(new Error(`Route not found: ${req.originalUrl}`));
}

// Central error handler — every controller can just `throw` or call
// next(err) and it lands here with a consistent JSON shape.
export function errorHandler(err, req, res, next) {
    const statusCode = res.statusCode !== 200
        ? res.statusCode
        : err.name === "CastError"
            ? 404
            : 500;
    const isProduction = process.env.NODE_ENV === "production";
    res.status(statusCode).json({
        message: isProduction && statusCode >= 500
            ? "Internal server error"
            : err.message,
        ...(isProduction ? {} : { stack: err.stack }),
    });
}