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

  return new Promise((resolve, reject) => {
    try {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'fynd/banners', resource_type: 'image' },
        (error, result) => {
          if (error || !result?.secure_url) {
            reject(new AppError('SERVER_ERROR', 'Image upload failed', 502));
            return;
          }
          resolve(result.secure_url);
        },
      );

      stream.end(buffer);
    } catch {
      reject(new AppError('SERVER_ERROR', 'Image upload failed', 502));
    }
  });
}
