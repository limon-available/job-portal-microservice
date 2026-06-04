import express from "express";
import dotenv from "dotenv";
import routes from "./routes.js";
import cors from "cors";
import { v2 as cloudinary } from "cloudinary";
import { startSendMailConsumer } from "./consumer.js";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME as string,
  api_key: process.env.CLOUDINARY_API_KEY as string,
  api_secret: process.env.CLOUDINARY_API_SECRET as string,
});

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(cors());
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use("/api/utils", routes);

const PORT = process.env.PORT || 5001;

app.listen(PORT, async () => {
  console.log(`Utils service is running on port ${PORT}`);

  await startSendMailConsumer();
});