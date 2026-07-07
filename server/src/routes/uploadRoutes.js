const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { uploadProfile, uploadMessage, uploadCompanyLogo, deleteFromCloudinary, optimizeImageUrl } = require("../config/cloudinary");
const { uploadLimiter } = require("../middleware/security");

const router = express.Router();

// Apply upload rate limiting to all routes
router.use(uploadLimiter);

// Upload profile picture
router.post("/profile", requireAuth, (req, res) => {
  uploadProfile.single('profile')(req, res, async (err) => {
    if (err) {
      console.error('Profile upload error:', err);
      return res.status(400).json({ 
        error: err.message || 'File upload failed',
        timestamp: new Date().toISOString()
      });
    }
    
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No file provided',
        timestamp: new Date().toISOString()
      });
    }
    
    try {
      // Log successful upload
      console.log(`Profile image uploaded by ${req.user.email}: ${req.file.filename}`);
      
      const optimizedUrl = optimizeImageUrl(req.file.path, { width: 200, height: 200 });
      
      res.json({
        message: 'Profile picture uploaded successfully',
        file: {
          url: req.file.path,
          optimizedUrl,
          publicId: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Profile upload processing error:', error);
      res.status(500).json({ 
        error: 'Upload processing failed',
        timestamp: new Date().toISOString()
      });
    }
  });
});

// Upload message attachments
router.post("/message", requireAuth, (req, res) => {
  uploadMessage.array('attachments', 3)(req, res, async (err) => {
    if (err) {
      console.error('Message attachment upload error:', err);
      return res.status(400).json({ 
        error: err.message || 'File upload failed',
        timestamp: new Date().toISOString()
      });
    }
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        error: 'No files provided',
        timestamp: new Date().toISOString()
      });
    }
    
    try {
      // Log successful upload
      console.log(`Message attachments uploaded by ${req.user.email}: ${req.files.length} files`);
      
      const files = req.files.map(file => ({
        url: file.path,
        optimizedUrl: file.mimetype.startsWith('image/') 
          ? optimizeImageUrl(file.path, { width: 600, height: 400 })
          : file.path,
        publicId: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype
      }));
      
      res.json({
        message: 'Files uploaded successfully',
        files,
        count: files.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Message upload processing error:', error);
      res.status(500).json({ 
        error: 'Upload processing failed',
        timestamp: new Date().toISOString()
      });
    }
  });
});

// Upload company logo (admin only)
router.post("/company-logo", requireAuth, (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Admin access required',
      timestamp: new Date().toISOString()
    });
  }
  
  uploadCompanyLogo.single('logo')(req, res, async (err) => {
    if (err) {
      console.error('Company logo upload error:', err);
      return res.status(400).json({ 
        error: err.message || 'Logo upload failed',
        timestamp: new Date().toISOString()
      });
    }
    
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No logo file provided',
        timestamp: new Date().toISOString()
      });
    }
    
    try {
      console.log(`Company logo uploaded by ${req.user.email}: ${req.file.filename}`);
      
      const optimizedUrl = optimizeImageUrl(req.file.path, { width: 300, height: 200 });
      
      res.json({
        message: 'Company logo uploaded successfully',
        file: {
          url: req.file.path,
          optimizedUrl,
          publicId: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Logo upload processing error:', error);
      res.status(500).json({ 
        error: 'Upload processing failed',
        timestamp: new Date().toISOString()
      });
    }
  });
});

// Delete file from Cloudinary
router.delete("/file/:publicId", requireAuth, async (req, res) => {
  try {
    const { publicId } = req.params;
    
    if (!publicId) {
      return res.status(400).json({ 
        error: 'Public ID required',
        timestamp: new Date().toISOString()
      });
    }
    
    // Security: Only allow users to delete their own files or admins to delete any file
    // This would need more sophisticated logic in production to track file ownership
    
    const result = await deleteFromCloudinary(publicId);
    
    console.log(`File deleted from Cloudinary by ${req.user.email}: ${publicId}`);
    
    res.json({
      message: 'File deleted successfully',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('File deletion error:', error);
    res.status(500).json({ 
      error: 'File deletion failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Get upload status and limits
router.get("/status", requireAuth, (req, res) => {
  try {
    res.json({
      status: 'available',
      limits: {
        profilePicture: {
          maxSize: '2MB',
          allowedTypes: ['jpg', 'jpeg', 'png'],
          maxFiles: 1
        },
        messageAttachments: {
          maxSize: '5MB',
          allowedTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx'],
          maxFiles: 3
        },
        companyLogo: {
          maxSize: '1MB',
          allowedTypes: ['jpg', 'jpeg', 'png'],
          maxFiles: 1,
          adminOnly: true
        }
      },
      rateLimit: {
        window: '1 minute',
        maxUploads: 2
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Upload status error:', error);
    res.status(500).json({ 
      error: 'Failed to get upload status',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;