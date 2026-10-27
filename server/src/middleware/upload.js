import multer from 'multer';
import AppError from '../utils/AppError.js';

function createUploader(allowedTypes, invalidTypeMessage, fileSizeMessage) {
  const uploader = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter(req, file, callback) {
      if (!allowedTypes.includes(file.mimetype)) {
        callback(new AppError('VALIDATION_ERROR', invalidTypeMessage));
        return;
      }
      callback(null, true);
    },
  });

  return (fieldName) => {
    const middleware = uploader.single(fieldName);
    return (req, res, next) => {
      middleware(req, res, (error) => {
        if (!error) {
          next();
          return;
        }

        if (error instanceof multer.MulterError) {
          const message = error.code === 'LIMIT_FILE_SIZE'
            ? fileSizeMessage
            : 'Invalid file upload';
          next(new AppError('VALIDATION_ERROR', message));
          return;
        }

        next(error);
      });
    };
  };
}

const imageSingle = createUploader(
  ['image/jpeg', 'image/png', 'image/webp'],
  'Only JPEG, PNG, and WebP images are allowed',
  'Image must be 5 MB or smaller',
);
const proofSingle = createUploader(
  ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  'Only JPEG, PNG, WebP, and PDF files are allowed',
  'Proof file must be 5 MB or smaller',
);

export const upload = {
  single: imageSingle,
  proof: proofSingle,
};
