import { v2 as cloudinary } from 'cloudinary';
import { config } from './env.js';
import AppError from '../utils/AppError.js';

const cloudinaryConfigured = Boolean(
  config.cloudinaryCloudName &&
  config.cloudinaryApiKey &&
  config.cloudinaryApiSecret,
);

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: config.cloudinaryCloudName,
    api_key: config.cloudinaryApiKey,
    api_secret: config.cloudinaryApiSecret,
  });
}

export function uploadBanner(buffer) {
  if (!cloudinaryConfigured) {
    throw new AppError('SERVER_ERROR', 'Image uploads are not configured', 503);
  }
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'A non-empty image file is required');
  }

  return new Promise((resolve, reject) => {
    try {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'fynd/banners', resource_type: 'image' },
        (error, result) => {
          if (error) {
            console.error('Cloudinary banner upload failed:', {
              message: error.message,
              http_code: error.http_code,
              name: error.name,
            });
            const uploadError = new AppError('SERVER_ERROR', 'Image upload failed', 502);
            uploadError.cloudinaryError = error;
            reject(uploadError);
            return;
          }

          if (!result?.secure_url) {
            reject(new AppError('SERVER_ERROR', 'Image upload failed', 502));
            return;
          }

          resolve(result.secure_url);
        },
      );

      stream.end(buffer);
    } catch (error) {
      console.error('Cloudinary banner upload failed:', {
        message: error.message,
        http_code: error.http_code,
        name: error.name,
      });
      const uploadError = new AppError('SERVER_ERROR', 'Image upload failed', 502);
      uploadError.cloudinaryError = error;
      reject(uploadError);
    }
  });
}
