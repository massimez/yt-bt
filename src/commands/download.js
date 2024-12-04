const fs = require("fs");
const path = require("path");
const { formatFileSize, sanitizeFileName } = require("../helpers/main");
const ytdl = require("@distube/ytdl-core");
const cp = require("child_process");
const readline = require("readline");
const ffmpeg = require("ffmpeg-static");

require("dotenv").config();
const DOWNLOAD_DIR = path.join(__dirname, "../downloads");
const CHANNEL_USERNAME = process.env.CHANNEL_USERNAME;
const ERROR_MESSAGES = {
  notSubscribed: `Пожалуйста, подпишитесь, чтобы продолжить использовать бота: ${CHANNEL_USERNAME} 🙂`,
  invalidUrl: "Пожалуйста, отправьте действительный URL видео YouTube.",
  noSuitableFormat: "Не найдено подходящего формата",
  uploadFailed: "❌ Не удалось загрузить видео. Пожалуйста, попробуйте снова.",
  processingError:
    "❌ Извините, произошла ошибка при обработке вашего видео. Пожалуйста, попробуйте позже.",
  serviceUnavailable: "",
};

// In-memory store for tracking user requests
const userRequests = {};
const RATE_LIMIT_TIME = 10000; // 10 seconds
const validQualities = [
  "144p",
  "240p",
  "360p",
  "480p",
  "720p",
  "1080p",
  "1440p",
  "2160p",
];
async function downloadVideo(videoUrl, chatId, bot, userId) {
  // Check if the user is currently processing a request
  if (userRequests[userId] && userRequests[userId].isProcessing) {
    return await bot.sendMessage(
      chatId,
      "⏳ Пожалуйста, подождите, пока ваш предыдущий запрос не будет завершен."
    );
  }
  // Set the user as processing
  userRequests[userId] = { isProcessing: true };

  try {
    ensureDownloadDirectory();
    await checkUserSubscription(bot, chatId, userId);
    validateVideoUrl(videoUrl, chatId, bot);
    const processingMessage = await bot.sendMessage(
      chatId,
      "🎥 Обработка видео..."
    );
    const videoInfo = await ytdl.getInfo(videoUrl);
    const videoTitle = videoInfo.videoDetails.title;
    const sanitizedTitle = sanitizeFileName(videoTitle);

    await updateProcessingMessage(
      bot,
      chatId,
      processingMessage.message_id,
      videoTitle
    );
    const selectedFormat = getVideoFormat(videoInfo.formats, "360p");

    const filePath = await downloadVideoFile(
      videoUrl,
      selectedFormat,
      sanitizedTitle,
      bot,
      chatId,
      processingMessage.message_id,
      videoTitle
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
  } finally {
    // Reset the user's processing status after the request is complete
    userRequests[userId].isProcessing = false;

    // Set a timeout to remove the user from the requests object after the rate limit time
    setTimeout(() => {
      delete userRequests[userId];
    }, RATE_LIMIT_TIME);
  }
}

function ensureDownloadDirectory() {
  if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR);
  }
}

async function checkUserSubscription(bot, chatId, userId) {
  let chatMember;
  try {
    chatMember = await bot.getChatMember(CHANNEL_USERNAME, userId);
  } catch (error) {}
  if (
    chatMember &&
    !["member", "administrator", "creator"].includes(chatMember.status)
  ) {
    throw new Error(ERROR_MESSAGES.notSubscribed);
  }
}

function validateVideoUrl(videoUrl, chatId, bot) {
  if (!videoUrl || !isValidYoutubeUrl(videoUrl)) {
    throw new Error(ERROR_MESSAGES.invalidUrl);
  }
}

const getVideoFormat = (formats, quality) => {
  // First, try to find HDR format if quality is 4K or above

  // if (["2160p"].includes(quality)) {
  //   const hdrFormat = formats.find(
  //     (format) =>
  //       format.qualityLabel === quality &&
  //       format.hasVideo &&
  //       (format.colorInfo?.primaries === "bt2020" ||
  //         format.colorInfo?.transferCharacteristics === "smpte2084")
  //   );
  //   if (hdrFormat) return hdrFormat;
  // }

  // If HDR not found or not applicable, look for standard format
  let format = formats.find((format) => {
    const isQualityMatch = quality ? format.qualityLabel === quality : true;
    return isQualityMatch && format.hasVideo && format.hasAudio;
  });

  if (!format) {
    format = formats.find(
      (format) => format.qualityLabel === quality && format.hasVideo
    );
  }

  return format;
};

async function updateProcessingMessage(bot, chatId, messageId, videoTitle) {
  try {
    await bot.editMessageText(
      `🎥 Загрузка видео...\nНазвание: ${videoTitle}\n`,
      {
        chat_id: chatId,
        message_id: messageId,
      }
    );
  } catch (error) {
    console.error(error.message);
  }
}
// Global error handling
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});
async function downloadVideoFile(
  url,
  videoFormat,
  sanitizedTitle,
  bot,
  chatId,
  messageId,
  videoTitle
) {
  const tracker = {
    start: Date.now(),
    audio: { downloaded: 0, total: Infinity },
    video: { downloaded: 0, total: Infinity },
    merged: { frame: 0, speed: "0x", fps: 0 },
  };
  // Function to show progress
  const showProgress = () => {
    readline.cursorTo(process.stdout, 0);
    const toMB = (i) => (i / 1024 / 1024).toFixed(2);

    process.stdout.write(
      `Audio  | ${(
        (tracker.audio.downloaded / tracker.audio.total) *
        100
      ).toFixed(2)}% processed `
    );
    process.stdout.write(
      `(${toMB(tracker.audio.downloaded)}MB of ${toMB(
        tracker.audio.total
      )}MB).${" ".repeat(10)}\n`
    );

    process.stdout.write(
      `Video  | ${(
        (tracker.video.downloaded / tracker.video.total) *
        100
      ).toFixed(2)}% processed `
    );
    process.stdout.write(
      `(${toMB(tracker.video.downloaded)}MB of ${toMB(
        tracker.video.total
      )}MB).${" ".repeat(10)}\n`
    );

    process.stdout.write(`Merged | processing frame ${tracker.merged.frame} `);
    process.stdout.write(
      `(at ${tracker.merged.fps} fps => ${tracker.merged.speed}).${" ".repeat(
        10
      )}\n`
    );

    process.stdout.write(
      `Running for: ${((Date.now() - tracker.start) / 1000 / 60).toFixed(
        2
      )} Minutes.`
    );
    readline.moveCursor(process.stdout, 0, -3);
  };

  const outputFilePath = path.join(
    DOWNLOAD_DIR,
    `${sanitizedTitle}_output_${Date.now()}.mp4`
  );
  // Function to attempt downloading video and audio
  const attemptDownload = (attempt) => {
    return new Promise((resolve, reject) => {
      // Get audio and video streams
      const audio = ytdl(url, { quality: "highestaudio" })
        .on("progress", (_, downloaded, total) => {
          tracker.audio = { downloaded, total };
        })
        .on("error", (error) => {
          console.error("Error downloading audio:", error);
          if (attempt < retries) {
            console.log(`Retrying audio download... Attempt ${attempt + 1}`);
            attemptDownload(attempt + 1)
              .then(resolve)
              .catch(reject);
          } else {
            bot.sendMessage(
              chatId,
              "An error occurred while downloading the audio."
            );
            cleanupCallback();
            reject(error);
          }
        });

      const video = ytdl(url, { format: videoFormat })
        .on("progress", (_, downloaded, total) => {
          tracker.video = { downloaded, total };
        })
        .on("error", (error) => {
          console.error("Error downloading video:", error);
          if (attempt < retries) {
            console.log(`Retrying video download... Attempt ${attempt + 1}`);
            attemptDownload(attempt + 1)
              .then(resolve)
              .catch(reject);
          } else {
            bot.sendMessage(
              chatId,
              "An error occurred while downloading the video."
            );
            cleanupCallback();
            reject(error);
          }
        });

      // Prepare the progress bar
      let progressbarHandle = null;
      const progressbarInterval = 3500;

      const ffmpegProcess = cp.spawn(
        ffmpeg,
        [
          "-loglevel",
          "8",
          "-hide_banner",
          "-progress",
          "pipe:3",
          "-i",
          "pipe:4",
          "-i",
          "pipe:5",
          "-map",
          "0:a",
          "-map",
          "1:v",
          "-preset",
          "veryfast",
          "-c:v",
          "copy",
          outputFilePath,
        ],
        {
          windowsHide: true,
          stdio: ["inherit", "inherit", "inherit", "pipe", "pipe", "pipe"],
        }
      );

      ffmpegProcess.on("close", (code) => {
        clearInterval(progressbarHandle);
        if (code === 0) {
          console.log("FFmpeg process completed successfully.");
          resolve(outputFilePath); // Resolve with the output file path
        } else {
          console.error(`FFmpeg process exited with code ${code}`);
          reject(new Error(`FFmpeg process failed with code ${code}`));
        }
      });

      ffmpegProcess.stdio[3].on("data", (chunk) => {
        if (!progressbarHandle) {
          progressbarHandle = setInterval(() => {
            showProgress();
            try {
              console.log(chatId);
              bot.editMessageText(
                `🎥 Загрузка видео...\nНазвание: ${videoTitle}\nПрогресс:${` ${(
                  (tracker.video.downloaded / tracker.video.total) *
                  100
                ).toFixed(2)}% `} %`,
                {
                  chat_id: chatId,
                  message_id: messageId,
                }
              );
            } catch (error) {
              console.log(error.message);
            }
          }, progressbarInterval);
        }
        const lines = chunk.toString().trim().split("\n");
        const args = {};
        for (const l of lines) {
          const [key, value] = l.split("=");
          args[key.trim()] = value.trim();
        }
        tracker.merged = args;
      });

      audio.pipe(ffmpegProcess.stdio[4]);
      video.pipe(ffmpegProcess.stdio[5]);
    });
  };

  // Start the download attempt
  try {
    await attemptDownload(0);
    return outputFilePath;
  } catch (error) {
    console.log(error);
  }

  // const filePath = path.join(DOWNLOAD_DIR, `${sanitizedTitle}.mp4`);
  // const fileStream = fs.createWriteStream(filePath);
  // const videoStream = ytdl(videoUrl);
  // videoStream.pipe(fileStream);
  // return new Promise((resolve, reject) => {
  //   videoStream.pipe(fileStream);
  //   fileStream.on("finish", () => resolve(filePath));
  //   fileStream.on("error", (error) => {
  //     console.error("Ошибка потока файла:", error.message);
  //     reject(new Error(ERROR_MESSAGES.uploadFailed));
  //   });
  // });
  // const response = await axios({
  //   url: videoUrl,
  //   method: "GET",
  //   responseType: "stream",
  // });
  // if (response.status !== 200) {
  //   throw new Error(ERROR_MESSAGES.uploadFailed);
  // }
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
