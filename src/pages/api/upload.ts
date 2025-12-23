import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import path from 'path';
import fs from 'fs/promises';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });

    const form = formidable({
      uploadDir,
      keepExtensions: true,
      maxFileSize: 50 * 1024 * 1024, // 50MB for PDFs
      filename: (name, ext, part) => {
        // Use the encrypted filename passed from the client
        return part.originalFilename || name;
      }
    });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('Upload error:', err);
        return res.status(500).json({ error: 'Failed to upload file' });
      }

      const file = files.file[0];
      const filePath = file.filepath;
      const fileName = fields.fileName?.[0];
      const targetPath = path.join(uploadDir, fileName);

      // Rename the file to use the encrypted filename
      await fs.rename(filePath, targetPath);

      const relativePath = path.relative(
        path.join(process.cwd(), 'public'),
        targetPath
      ).replace(/\\/g, '/');

      res.status(200).json({ url: '/' + relativePath });
    });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
