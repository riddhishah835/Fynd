import multer from 'multer';
import AppError from '../utils/AppError.js';

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, callback) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(new AppError('VALIDATION_ERROR', 'Only JPEG, PNG, and WebP images are allowed'));
      return;
    }
    callback(null, true);
  },
});

export const upload = {
  single(fieldName) {
    const middleware = imageUpload.single(fieldName);
    return (req, res, next) => {
      middleware(req, res, (error) => {
        if (!error) {
          next();
          return;
        }

        if (error instanceof multer.MulterError) {
          const message = error.code === 'LIMIT_FILE_SIZE'
            ? 'Image must be 5 MB or smaller'
            : 'Invalid image upload';
          next(new AppError('VALIDATION_ERROR', message));
          return;
        }

        next(error);
      });
    };
  },
};
