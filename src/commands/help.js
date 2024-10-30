function handleHelp(msg, bot) {
  const helpMessage = `
Как использовать этого бота:

1. Найдите видео на YouTube, которое хотите скачать.
2. Скопируйте URL видео.
3. Отправьте URL этому боту.
4. Подождите, пока загрузка завершится.

Примечание:
- Поддерживаются только видео с YouTube.
- Время обработки зависит от длины и размера видео.

Если у вас возникли проблемы, пожалуйста, попробуйте позже.
  `;

  const keyboard = {
    reply_markup: {
      keyboard: [[{ text: "/start" }, { text: "/help" }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };

  bot.sendMessage(msg.chat.id, helpMessage, keyboard);
}

module.exports = { handleHelp };
