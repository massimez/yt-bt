const fs = require("fs");
const path = require("path");
const { formatFileSize, sanitizeFileName } = require("../helpers/main");
const ytdl = require("@distube/ytdl-core");
require("dotenv").config();
const { ytdown } = require("nayan-media-downloader");
const axios = require("axios");

const CHANNEL_USERNAME = process.env.CHANNEL_USERNAME;
const DOWNLOAD_DIR = path.join(__dirname, "../downloads");
const ERROR_MESSAGES = {
  notSubscribed: `Пожалуйста, подпишитесь, чтобы продолжить использовать бота: ${CHANNEL_USERNAME}`,
  invalidUrl: "Пожалуйста, отправьте действительный URL видео YouTube.",
  noSuitableFormat: "Не найдено подходящего формата",
  uploadFailed: "❌ Не удалось загрузить видео. Пожалуйста, попробуйте снова.",
  processingError:
    "❌ Извините, произошла ошибка при обработке вашего видео. Пожалуйста, попробуйте позже.",
};

async function downloadVideo(videoUrl, chatId, bot, userId) {
  try {
    ensureDownloadDirectory();
    await checkUserSubscription(bot, chatId, userId);
    validateVideoUrl(videoUrl, chatId, bot);

    const processingMessage = await bot.sendMessage(
      chatId,
      "🎥 Обработка видео..."
    );

    let { data: ytVideoData } = await ytdown(videoUrl);
    const videoTitle = ytVideoData.title;
    const sanitizedTitle = sanitizeFileName(videoTitle);
    const selectedFormat = "video";

    await updateProcessingMessage(
      bot,
      chatId,
      processingMessage.message_id,
      videoTitle
    );
    const filePath = await downloadVideoFile(
      ytVideoData.video,
      selectedFormat,
      sanitizedTitle
    );

    await sendVideoToChat(bot, chatId, filePath, videoTitle);
    await bot
      .deleteMessage(chatId, processingMessage.message_id)
      .catch(() => {});
    fs.unlinkSync(filePath);
  } catch (error) {
    console.error("Ошибка:", error.message);
    await bot.sendMessage(
      chatId,
      error.message || ERROR_MESSAGES.processingError
    );
  }
}

function ensureDownloadDirectory() {
  if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR);
  }
}

async function checkUserSubscription(bot, chatId, userId) {
  const chatMember = await bot.getChatMember(CHANNEL_USERNAME, userId);
  if (!["member", "administrator", "creator"].includes(chatMember.status)) {
    throw new Error(ERROR_MESSAGES.notSubscribed);
  }
}

function validateVideoUrl(videoUrl, chatId, bot) {
  if (!videoUrl || !isValidYoutubeUrl(videoUrl)) {
    throw new Error(ERROR_MESSAGES.invalidUrl);
  }
}

function getBestFormat(formats) {
  const suitableFormats = formats.filter(
    (format) => format.container === "mp4" && format.hasAudio && format.hasVideo
  );
  if (suitableFormats.length === 0) {
    throw new Error(ERROR_MESSAGES.noSuitableFormat);
  }
  console.log(suitableFormats);
  return suitableFormats.sort(
    (a, b) => parseInt(b.bitrate) - parseInt(a.bitrate)
  )[0];
}

async function updateProcessingMessage(bot, chatId, messageId, videoTitle) {
  await bot.editMessageText(`🎥 Загрузка видео...\nНазвание: ${videoTitle}\n`, {
    chat_id: chatId,
    message_id: messageId,
  });
}

async function downloadVideoFile(videoUrl, selectedFormat, sanitizedTitle) {
  const filePath = path.join(DOWNLOAD_DIR, `${sanitizedTitle}.mp4`);
  const fileStream = fs.createWriteStream(filePath);
  const response = await axios({
    url: videoUrl,
    method: "GET",
    responseType: "stream",
  });
  if (response.status !== 200) {
    throw new Error(ERROR_MESSAGES.uploadFailed);
  }
  return new Promise((resolve, reject) => {
    response.data.pipe(fileStream);
    fileStream.on("finish", () => resolve(filePath));
    fileStream.on("error", (error) => {
      console.error("Ошибка потока файла:", error.message);
      reject(new Error(ERROR_MESSAGES.uploadFailed));
    });
  });
}

async function sendVideoToChat(bot, chatId, filePath, videoTitle) {
  await bot.sendVideo(chatId, filePath, {
    caption: `📹 ${videoTitle}\n💾 Размер: ${formatFileSize(
      fs.statSync(filePath).size
    )}\n`,
  });
}

function isValidYoutubeUrl(url) {
  return ytdl.validateURL(url);
}

module.exports = { downloadVideo };
