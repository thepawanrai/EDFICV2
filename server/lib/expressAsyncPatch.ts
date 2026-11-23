import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

try {
  // Forward rejected promises from Express 4 async route handlers to next(err)
  // so transient DB/request errors return 500 JSON instead of crashing Node.
  const Layer = require('express/lib/router/layer') as {
    prototype: {
      handle_request: (req: unknown, res: unknown, next: (err?: unknown) => void) => unknown;
    };
  };

  Layer.prototype.handle_request = function handleRequestAsync(
    this: { handle: (...args: unknown[]) => unknown },
    req: unknown,
    res: unknown,
    next: (err?: unknown) => void
  ) {
    const fn = this.handle;
    if (fn.length > 3) {
      return next();
    }

    try {
      const result = fn(req, res, next);
      if (result && typeof (result as Promise<unknown>).catch === 'function') {
        (result as Promise<unknown>).catch(next);
      }
      return result;
    } catch (err) {
      return next(err);
    }
  };
} catch {
  // Ignore if Express internal router module layout differs
}
