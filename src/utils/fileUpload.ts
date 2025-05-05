interface UploadOptions {
  folder?: string;
  allowedTypes?: string[];
  maxSize?: number;
}

export const uploadFile = async (file: File, options?: UploadOptions): Promise<string> => {
  try {
    // Default max size to 10MB
    const maxSize = options?.maxSize || 10 * 1024 * 1024; // 10MB in bytes

    // Validate file size
    if (file.size > maxSize) {
      throw new Error(`File size must be less than ${Math.round(maxSize / (1024 * 1024))}MB`);
    }

    // Validate file type if specified
    if (options?.allowedTypes && !options.allowedTypes.includes(file.type)) {
      throw new Error(`Invalid file type. Allowed types: ${options.allowedTypes.join(', ')}`);
    }

    // Create form data for Cloudinary upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);
    
    if (options?.folder) {
      formData.append('folder', options.folder);
    }

    // Upload to Cloudinary
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/upload`,
      {
        method: 'POST',
        body: formData
      }
    );

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    const data = await response.json();
    return data.secure_url;

  } catch (error: any) {
    console.error('Error uploading file:', error);
    throw new Error(error.message || 'Upload failed');
  }
};

export const getLocalFileUrl = (localUrl: string): string | null => {
  try {
    if (!localUrl.startsWith('local://')) return localUrl;
    
    const fileId = localUrl.replace('local://', '');
    const storedFiles = JSON.parse(localStorage.getItem('uploadedFiles') || '[]');
    const file = storedFiles.find(f => f.id === fileId);
    
    return file ? file.data : null;
  } catch (error) {
    console.error('Error getting local file:', error);
    return null;
  }
};

// Alternative local storage function if needed
export const saveFileLocally = async (file: File, options?: UploadOptions): Promise<string> => {
  try {
    // Generate a unique filename
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = `/uploads/${options?.folder || ''}/${fileName}`;
    
    // For local storage, we would need to implement an API endpoint to handle the file storage
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', filePath);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Local file upload failed');
    }

    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error('Error saving file locally:', error);
    throw error;
  }
};
