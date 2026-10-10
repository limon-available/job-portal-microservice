import multer from "multer"
const storage=multer.memoryStorage();
const uploadFile=multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
}).single("file")
export default uploadFile;