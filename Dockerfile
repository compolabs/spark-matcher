# Используем более новую базовую версию Node.js
FROM node:16-slim

# Создаем директорию приложения и назначаем права пользователя 'node'
WORKDIR /home/node/app
RUN mkdir dist && chown -R node:node /home/node/app

# Копируем файлы проекта
COPY --chown=node:node . .

# Устанавливаем зависимости
USER node
RUN npm install

# Собираем проект
RUN npm run build

# Открываем порт и указываем команду для запуска
EXPOSE 5000
CMD ["node", "dist/server.js"]
