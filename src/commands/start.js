function handleStart(msg, bot) {
  const welcomeMessage = `
Добро пожаловать в бот для загрузки видео с YouTube! 🎥

Я могу помочь вам скачать видео с YouTube. Просто отправьте мне ссылку на видео, и я загружу его для вас.

Просто отправьте мне <b>URL видео с YouTube</b>, чтобы начать!
  `;

  bot.sendMessage(msg.chat.id, welcomeMessage, { parse_mode: "HTML" });
}

module.exports = { handleStart };
