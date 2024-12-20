const TelegramBot = require("node-telegram-bot-api");
const { setupDownloadDirectory } = require("./helpers/main");
const { handleStart } = require("./commands/start");
const { handleHelp } = require("./commands/help");
const { downloadVideo } = require("./commands/download");
const cp = require("child_process");
const ffmpeg = require("ffmpeg-static");

require("dotenv").config();

// Создание директории для загрузок
setupDownloadDirectory();

// Инициализация бота
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Обработчик сообщений
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const messageText = msg.text;

  if (messageText?.startsWith("/")) return;

  // Проверка URL YouTube и загрузка видео
  downloadVideo(messageText, chatId, bot, userId);
});

bot.onText(/\/start/, (msg) => handleStart(msg, bot));

bot.onText(/\/help/, (msg) => handleHelp(msg, bot));

// Обработчик ошибок для опроса
bot.on("polling_error", (error) => {
  console.error("Ошибка опроса:", error);
});

// Запуск бота
console.log("Бот запущен...");
