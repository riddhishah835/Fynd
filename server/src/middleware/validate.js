export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      next(result.error);
      return;
    }

    Object.defineProperty(req, source, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: result.data,
    });
    next();
  };
}
