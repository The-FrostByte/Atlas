import Attachment from '../models/Attachment.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const downloadAttachment = async (req, res) => {
  try {
    const attachment = await Attachment.findOne({ id: req.params.id });
    if (!attachment) return res.status(404).json({ message: "File not found" });

    // Build absolute path to the file in the /uploads folder
    const filePath = path.join(__dirname, '../../uploads', attachment.filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Physical file missing from server" });
    }

    // Set the filename for the user's browser download
    res.download(filePath, attachment.original_filename);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteAttachment = async (req, res) => {
  try {
    const attachment = await Attachment.findOne({ id: req.params.id });
    if (!attachment) return res.status(404).json({ message: "File not found" });

    // Security check: Only Admins or the uploader can delete
    if (req.user.role !== 'admin' && attachment.uploaded_by !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized to delete this file" });
    }

    // 1. Delete the physical file from disk
    const filePath = path.join(__dirname, '../../uploads', attachment.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // 2. Delete the record from MongoDB
    await Attachment.deleteOne({ id: req.params.id });

    res.json({ message: "Attachment deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};