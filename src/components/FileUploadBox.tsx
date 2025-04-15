import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface FileUploadBoxProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSize?: number;
  fileUrl?: string;
}

export default function FileUploadBox({ 
  onFileSelect, 
  accept = "application/pdf,image/*", 
  maxSize = 5 * 1024 * 1024,
  fileUrl
}: FileUploadBoxProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles?.[0]) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      [accept]: []
    },
    maxSize,
    multiple: false
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
          ${isDragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
          }
        `}
      >
        <input {...getInputProps()} />
        <div className="space-y-4">
          <svg 
            className="w-12 h-12 mx-auto text-gray-400"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5}
              d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2z"
            />
          </svg>
          
          <div className="text-gray-600">
            <p className="font-medium">
              {isDragActive ? 'Drop the file here' : 'Drag & drop a file here'}
            </p>
            <p className="text-sm mt-1">or click to browse</p>
          </div>
          
          <p className="text-xs text-gray-500">
            Maximum file size: 5MB
          </p>
        </div>
      </div>

      {fileUrl && (
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
          <svg 
            className="w-5 h-5 text-blue-500" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
            />
          </svg>
          <a 
            href={fileUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-700 flex-1 truncate"
          >
            {fileUrl}
          </a>
        </div>
      )}
    </div>
  );
}
