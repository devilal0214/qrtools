export const cleanupUnusedFiles = (usedUrls: string[]) => {
  try {
    const storedFiles = JSON.parse(localStorage.getItem('uploadedFiles') || '[]');
    const cleanedFiles = storedFiles.filter(file => 
      usedUrls.includes(`local://${file.id}`)
    );
    localStorage.setItem('uploadedFiles', JSON.stringify(cleanedFiles));
  } catch (error) {
    console.error('Error cleaning up files:', error);
  }
};
