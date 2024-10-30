const ytdl = require("@distube/ytdl-core");
const fs = require("fs");
const path = require("path");
const { formatFileSize, sanitizeFileName } = require("../helpers/main");
const CHANNEL_USERNAME = "@secrets_shopping";
async function downloadVideo(videoUrl, chatId, bot, userId) {
  try {
    ensureDownloadDirectory();
    const chatMember = await bot.getChatMember(CHANNEL_USERNAME, userId);
    if (
      !(
        chatMember.status === "member" ||
        chatMember.status === "administrator" ||
        chatMember.status === "creator"
      )
    ) {
      bot.sendMessage(
        chatId,
        `Пожалуйста, подпишитесь, чтобы продолжить использовать бота: ${CHANNEL_USERNAME}`
      );
      return;
    }
    if (!videoUrl || !isValidYoutubeUrl(videoUrl)) {
      // Проверка URL YouTube
      bot.sendMessage(
        chatId,
        "Пожалуйста, отправьте действительный URL видео YouTube."
      );
      return;
    }

    // Отправка начального сообщения о процессе
    const processingMessage = await bot.sendMessage(
      chatId,
      "🎥 Обработка видео..."
    );

    // Получение информации о видео
    const videoInfo = await ytdl.getInfo(videoUrl);
    const videoTitle = videoInfo.videoDetails.title;
    const sanitizedTitle = sanitizeFileName(videoTitle);
    const formats = videoInfo.formats.filter((format) => format.hasVideo);

    if (formats.length === 0) {
      throw new Error("Не найдено подходящего формата");
    }

    // Сортировка форматов по качеству и выбор лучшего
    const selectedFormat = formats.sort(
      (a, b) => parseInt(b.bitrate) - parseInt(a.bitrate)
    )[0];

    // Обновление сообщения с информацией о качестве
    await bot.editMessageText(
      `🎥 Загрузка видео...\nНазвание: ${videoTitle}\n`,
      {
        chat_id: chatId,
        message_id: processingMessage.message_id,
      }
    );

    // Загрузка видео и сохранение в файл
    const filePath = path.join(
      __dirname,
      "../downloads",
      `${sanitizedTitle}.mp4`
    ); //
    const videoStream = ytdl(videoUrl, { format: selectedFormat });
    const fileStream = fs.createWriteStream(filePath);

    videoStream.pipe(fileStream);

    fileStream.on("finish", async () => {
      try {
        // Отправка видеофайла
        await bot.sendVideo(chatId, filePath, {
          caption: `📹 ${videoTitle}\n💾 Размер: ${formatFileSize(
            fs.statSync(filePath).size
          )}\n`,
        });
        await bot
          .deleteMessage(chatId, processingMessage.message_id)
          .catch(() => {});
      } catch (err) {
        console.error(err.message);
        await bot.sendMessage(
          chatId,
          "❌ Не удалось загрузить видео." + err.message
        );
      } finally {
        // Удаление загруженного файла
        fs.unlinkSync(filePath);
      }
    });

    fileStream.on("error", async (error) => {
      console.error("Ошибка потока файла:", error.message);
      await bot.sendMessage(
        chatId,
        "❌ Не удалось загрузить видео. Пожалуйста, попробуйте снова."
      );
    });
  } catch (error) {
    console.error("Ошибка:", error.message);
    await bot.sendMessage(
      chatId,
      error.message ||
        "❌ Извините, произошла ошибка при обработке вашего видео. Пожалуйста, попробуйте позже."
    );
  }
}

function isValidYoutubeUrl(url) {
  const ytdl = require("@distube/ytdl-core");
  return ytdl.validateURL(url);
}
function ensureDownloadDirectory() {
  const downloadDir = path.join(__dirname, "../downloads"); // Adjust the path as necessary
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir);
  }
}
module.exports = { downloadVideo };
