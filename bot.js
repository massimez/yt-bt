const TelegramBot = require("node-telegram-bot-api");
const ytdl = require("@distube/ytdl-core");

const express = require("express");
const app = express();
const port = 3000;
require("dotenv").config();

// Replace with your own token
const token = process.env.TELEGRAM_BOT_TOKEN;

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });

// Start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Send me a YouTube link!");
});

// Handle incoming messages
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const url = msg.text;

  // Check if the message is a valid YouTube link
  if (ytdl.validateURL(url)) {
    const videoId = ytdl.getURLVideoID(url);
    const downloadLink = `http://localhost:${port}/download/${videoId}`;
    bot.sendMessage(chatId, `Download your video here: ${downloadLink}`);
  } else {
    bot.sendMessage(chatId, "Please send a valid YouTube link.");
  }
});

// Set up an Express server to handle downloads
app.get("/download/:id", (req, res) => {
  const videoId = req.params.id;
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  res.header("Content-Disposition", 'attachment; filename="video.mp4"');
  ytdl(videoUrl, { quality: "highestvideo" }).pipe(res);
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
