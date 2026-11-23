import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    // Log API and health requests without exposing sensitive bodies, cookies, or tokens
    if (req.path.startsWith('/api') || req.path === '/health') {
      const durationMs = Date.now() - start;
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs,
        })
      );
    }
  });
  next();
}
