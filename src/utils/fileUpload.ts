const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/auto/upload`;

export const uploadFile = async (file: File) => {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File size must be less than 5MB');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET);
  
  // Set auto resource_type to handle all file types automatically
  formData.append('resource_type', 'auto');
  
  try {
    const response = await fetch(CLOUDINARY_URL, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message);
    }

    // For PDFs and other files, add dl=1 to force download
    const url = data.secure_url;
    return file.type === 'application/pdf' ? `${url}?dl=1` : url;
  } catch (error) {
    console.error('Upload error:', error);
    throw new Error('Failed to upload file');
  }
};
