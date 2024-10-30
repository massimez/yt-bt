const TelegramBot = require("node-telegram-bot-api");
const { setupDownloadDirectory } = require("./helpers/main");
const { handleStart } = require("./commands/start");
const { handleHelp } = require("./commands/help");
const { downloadVideo } = require("./commands/download");
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

  // Игнорировать команды
  if (messageText?.startsWith("/")) return;

  // Проверка URL YouTube и загрузка видео
  downloadVideo(messageText, chatId, bot, userId);
});

// Обработчик команды /start
bot.onText(/\/start/, (msg) => handleStart(msg, bot));

// Обработчик команды /help
bot.onText(/\/help/, (msg) => handleHelp(msg, bot));

// Обработчик ошибок для опроса
bot.on("polling_error", (error) => {
  console.error("Ошибка опроса:", error);
});

// Запуск бота
console.log("Бот запущен...");
