const crypto = require('crypto');

/**
 * Security utility for managing secrets and sensitive data
 */
class SecretsManager {
  constructor() {
    this.validateEnvironment();
  }

  /**
   * Validate that all required environment variables are set
   */
  validateEnvironment() {
    const requiredSecrets = [
      'JWT_SECRET',
      'SESSION_SECRET'
    ];

    const missingSecrets = requiredSecrets.filter(secret => !process.env[secret] || this.isPlaceholder(process.env[secret]));
    
    if (missingSecrets.length > 0) {
      console.error('SECURITY ERROR: Missing or invalid secrets detected:');
      missingSecrets.forEach(secret => {
        console.error(`  - ${secret}: ${!process.env[secret] ? 'not set' : 'using placeholder value'}`);
      });
      console.error('\nGenerate secure secrets using:');
      console.error('  node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
      
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Production deployment blocked: Invalid secrets configuration');
      } else {
        console.warn('WARNING: Development mode - generating temporary secrets');
        this.generateTemporarySecrets(missingSecrets);
      }
    }
  }

  /**
   * Check if a value is a placeholder that should not be used in production
   */
  isPlaceholder(value) {
    const placeholders = [
      'CHANGE_ME',
      'your-',
      'placeholder',
      'example',
      'test',
      'development'
    ];
    
    return placeholders.some(placeholder => 
      value.toLowerCase().includes(placeholder.toLowerCase())
    );
  }

  /**
   * Generate temporary secrets for development (not for production use)
   */
  generateTemporarySecrets(missingSecrets) {
    missingSecrets.forEach(secret => {
      if (!process.env[secret]) {
        const tempSecret = crypto.randomBytes(64).toString('hex');
        process.env[secret] = tempSecret;
        console.warn(`Generated temporary ${secret} for development`);
      }
    });
  }

  /**
   * Generate a cryptographically secure random string
   */
  static generateSecret(length = 64) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  static encrypt(text, key = process.env.ENCRYPTION_KEY) {
    if (!key) {
      throw new Error('Encryption key not configured');
    }
    
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  /**
   * Decrypt data encrypted with encrypt()
   */
  static decrypt(encryptedData, key = process.env.ENCRYPTION_KEY) {
    if (!key) {
      throw new Error('Encryption key not configured');
    }
    
    const algorithm = 'aes-256-gcm';
    const decipher = crypto.createDecipher(algorithm, key);
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Sanitize sensitive data for logging
   */
  static sanitizeForLogging(obj) {
    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'auth', 'credential',
      'jwt', 'session', 'cookie', 'authorization', 'bearer'
    ];
    
    const sanitized = { ...obj };
    
    Object.keys(sanitized).forEach(key => {
      const isSensitive = sensitiveFields.some(field => 
        key.toLowerCase().includes(field.toLowerCase())
      );
      
      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  /**
   * Validate OAuth configuration
   */
  validateOAuthConfig(provider) {
    const clientId = process.env[`${provider.toUpperCase()}_CLIENT_ID`];
    const clientSecret = process.env[`${provider.toUpperCase()}_CLIENT_SECRET`];
    
    if (!clientId || !clientSecret) {
      return false;
    }
    
    return !this.isPlaceholder(clientId) && !this.isPlaceholder(clientSecret);
  }
}

module.exports = SecretsManager;