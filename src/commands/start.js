const START_USERS_FILE = "start_users.json";
const fs = require("fs");

function handleStart(msg, bot) {
  const welcomeMessage = `
Добро пожаловать в бот для загрузки видео с YouTube! 🎥

Я могу помочь вам скачать видео с YouTube. Просто отправьте мне ссылку на видео, и я загружу его для вас.

Просто отправьте мне <b>URL видео с YouTube</b>, чтобы начать!
  `;

  saveStartUser(msg.from.id);

  bot.sendMessage(msg.chat.id, welcomeMessage, { parse_mode: "HTML" });
}

module.exports = { handleStart };

function saveStartUser(userId) {
  try {
    // Read existing users
    let users = [];
    try {
      const data = fs.readFileSync(START_USERS_FILE);
      users = JSON.parse(data);
    } catch {
      // File doesn't exist, start with empty array
    }

    // Add new user with current date
    const today = new Date();
    const dateStr = `${today.getDate()}.${
      today.getMonth() + 1
    }.${today.getFullYear()}`;

    // Check if user already exists
    if (!users.some((user) => user.id === userId)) {
      users.push({
        id: userId,
        date: dateStr,
      });

      // Save updated list
      fs.writeFileSync(START_USERS_FILE, JSON.stringify(users, null, 2));
    }
  } catch (error) {
    console.error("Error saving start user:", error);
  }
}
