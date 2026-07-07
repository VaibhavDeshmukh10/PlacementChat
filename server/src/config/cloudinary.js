const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Validate Cloudinary configuration at startup
const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME && 
  process.env.CLOUDINARY_API_KEY && 
  process.env.CLOUDINARY_API_SECRET
);

if (!isCloudinaryConfigured) {
  console.warn('⚠️  WARNING: Cloudinary configuration incomplete. File upload functionality will be disabled.');
  console.warn('   Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to enable file uploads.');
}

// Create storage configuration for different file types
const createCloudinaryStorage = (folder, allowedFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp']) => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: `placementdesk/${folder}`,
      allowed_formats: allowedFormats,
      transformation: [
        {
          width: 1000,
          height: 1000,
          crop: 'limit',
          quality: 'auto:good',
          format: 'auto'
        }
      ],
      use_filename: true,
      unique_filename: true
    }
  });
};

// Storage configurations for different use cases
const profileStorage = createCloudinaryStorage('profiles', ['jpg', 'jpeg', 'png']);
const messageStorage = createCloudinaryStorage('messages', ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx']);
const companyLogoStorage = createCloudinaryStorage('company-logos', ['jpg', 'jpeg', 'png', 'svg']);

// File filter function with enhanced security
const fileFilter = (req, file, cb) => {
  // Check file size (5MB limit)
  const maxSize = 5 * 1024 * 1024; // 5MB
  
  // Allowed MIME types
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  // Security: Check MIME type
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error('Invalid file type. Only images, PDFs, and Word documents are allowed.'));
  }
  
  // Security: Check file extension
  const allowedExtensions = /\.(jpg|jpeg|png|gif|webp|pdf|doc|docx)$/i;
  if (!allowedExtensions.test(file.originalname)) {
    return cb(new Error('Invalid file extension.'));
  }
  
  // Security: Prevent executable files
  const dangerousExtensions = /\.(exe|bat|cmd|com|pif|scr|vbs|js|jar|sh|php|py|rb|pl)$/i;
  if (dangerousExtensions.test(file.originalname)) {
    return cb(new Error('Executable files are not allowed.'));
  }
  
  cb(null, true);
};

// Create multer instances for different upload types
const uploadProfile = multer({
  storage: profileStorage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB for profiles
    files: 1
  }
});

const uploadMessage = multer({
  storage: messageStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB for message attachments
    files: 3 // Max 3 files per message
  }
});

const uploadCompanyLogo = multer({
  storage: companyLogoStorage,
  fileFilter: (req, file, cb) => {
    // Only images for company logos
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed for company logos.'));
    }
    fileFilter(req, file, cb);
  },
  limits: {
    fileSize: 1 * 1024 * 1024, // 1MB for logos
    files: 1
  }
});

// Utility functions
const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

const optimizeImageUrl = (url, options = {}) => {
  if (!url || !url.includes('cloudinary.com')) return url;
  
  const defaultOptions = {
    width: 400,
    height: 400,
    crop: 'fill',
    quality: 'auto:good',
    format: 'auto'
  };
  
  const finalOptions = { ...defaultOptions, ...options };
  
  // Insert transformations into Cloudinary URL
  return url.replace('/upload/', `/upload/w_${finalOptions.width},h_${finalOptions.height},c_${finalOptions.crop},q_${finalOptions.quality},f_${finalOptions.format}/`);
};

// Health check for Cloudinary
const testCloudinaryConnection = async () => {
  try {
    const result = await cloudinary.api.ping();
    return { status: 'connected', result };
  } catch (error) {
    return { status: 'error', error: error.message };
  }
};

module.exports = {
  cloudinary,
  uploadProfile,
  uploadMessage,
  uploadCompanyLogo,
  deleteFromCloudinary,
  optimizeImageUrl,
  testCloudinaryConnection
};