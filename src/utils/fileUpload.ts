interface UploadOptions {
  folder?: string;
  maxSize?: number;
  allowedTypes?: string[];
}

export async function uploadFile(file: File, options: UploadOptions = {}) {
  const { 
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = ['image/*'],
    folder = 'qr-files'
  } = options;

  // Validate file
  if (file.size > maxSize) {
    throw new Error(`File size must be less than ${maxSize / (1024 * 1024)}MB`);
  }

  console.log('Cloud name:', process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME);
  console.log('Upload preset:', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET);
  // Create form data
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);
  formData.append('folder', folder);

  // Upload to Cloudinary
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Cloudinary error:', errorText); // This will show the real reason
    throw new Error('Upload failed: ' + errorText);
  }

  const data = await response.json();
  return data.secure_url;
}

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
