require('dotenv').config(); // 🔐 Загружаем переменные из .env

const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 3000; 

// 🧠 Память для защиты от повторного использования кода VK и автоочистка
const usedCodes = new Map(); // 🆕 Map: code → timestamp
const recentIPs = new Map(); // 🆕 IP защита: IP → timestamp
let callCounter = 0; // 📊 Счётчик вызовов /auth/vk/callback (для отладки)

// ✅ Тестовый маршрут для проверки, что сервер жив
app.get('/test', (req, res) => {
  res.send('Test OK!');
});

// ===========================
// 🔗 Генерация ссылки авторизации через VK
// Этот маршрут вызывается, когда пользователь кликает "Войти через VK"
// Он редиректит на oauth.vk.com/authorize с параметрами
// ===========================
app.get('/auth/vk', (req, res) => {
  const CLIENT_ID = process.env.VK_CLIENT_ID; 
  const REDIRECT_URI = process.env.VK_REDIRECT_URI; 

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'offline,wall,groups,photos,email,friends,docs,video,status', // доступы
    v: '5.131'
  });

  res.redirect(`https://oauth.vk.com/authorize?${params.toString()}`);
});

// ===========================
// 🌐 Главная страница (по адресу "/")
// Можно использовать как заглушку или приветствие
// ===========================
app.get('/', (req, res) => {
  res.send('Добро пожаловать в магический проект Фокусника Альтаира! ✨');
});

// ===========================
// 🎯 Основной маршрут VK CALLBACK
// Приходит от VK после авторизации с параметром ?code=...
// Здесь мы обмениваем код на access_token
// ===========================
app.get('/auth/vk/callback', async (req, res) => {
  callCounter++; // 🆕
  console.log(`=== [VK CALLBACK] ВЫЗОВ #${callCounter} ===`);
  
  const ip = req.ip; // 🆕
  const now = Date.now();

  // 🛡 Блокировка повторных запросов с одного IP
  if (recentIPs.has(ip) && now - recentIPs.get(ip) < 5000) { // 🆕
    console.warn(`🔁 Повторный запрос с IP ${ip} — отклонён`);
    return res.status(429).send('Слишком частые запросы'); // 🆕
  }
  recentIPs.set(ip, now); // 🆕
  setTimeout(() => recentIPs.delete(ip), 60000); // 🆕 автоматическая очистка IP

  try {
    console.log('Вызван /auth/vk/callback');
    console.log('Query:', req.query);

    const { code, state } = req.query;

    // ❗Если нет кода — значит что-то пошло не так
    if (!code) {
      return res.status(400).send('Ошибка: нет кода авторизации!');
    }

    // ⛔ Блокируем повторное использование кода
    if (usedCodes.has(code)) { // 🆕
      console.warn('‼️ Код уже использован!');
      return res.sendFile(path.join(__dirname, 'public', 'error.html'));
    }

    usedCodes.set(code, now); // 🆕
    
    // 🔄 Формируем параметры для обмена кода на токен
    const tokenParams = new URLSearchParams({
      client_id: process.env.VK_CLIENT_ID,
      client_secret: process.env.VK_CLIENT_SECRET,
      redirect_uri: process.env.VK_REDIRECT_URI,
      code,
    });

    // 🔑 Отправляем запрос на получение access_token от VK
    const vkRes = await axios.get(`https://oauth.vk.com/access_token?${tokenParams.toString()}`);

    // Выведем ответ VK (token, user_id и т.п.)
    console.log('VK access_token response:', vkRes.data);

    // ✅ Показываем страницу успеха
    return res.sendFile(path.join(__dirname, 'public', 'success.html'));
    
  } catch (error) {
    console.error('Ошибка при обмене code на token:', error.response?.data || error.message);
    // ❌ Показываем страницу ошибки
    return res.sendFile(path.join(__dirname, 'public', 'error.html'));
  }
});

// ===========================
// 🧹 Автоочистка старых usedCodes каждые 60 секунд
// ===========================
setInterval(() => {
  const now = Date.now();
  const TTL = 2 * 60 * 1000; // 2 минуты
  for (const [code, timestamp] of usedCodes.entries()) {
    if (now - timestamp > TTL) {
      usedCodes.delete(code);
      console.log(`🧹 Удалён просроченный code: ${code}`);
    }
  }
}, 60000); // 🆕

app.get('/help', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'help.html'));
});

// ===========================
// 📂 Подключение статики (frontend и public папки)
// 🔒 Статические файлы не будут отдаваться по маршрутам /auth/*
// иначе Express дублирует /auth/vk/callback запрос в static
// ===========================

// 🆕 Логируем все обращения к статикам
app.use((req, res, next) => {
  console.log('[STATIC MIDDLEWARE] Запрос:', req.url);
  next();
});

// 🆕 Блокируем отдачу статики по путям, начинающимся с /auth
app.use((req, res, next) => {
  if (req.url.startsWith('/auth')) return next();
  express.static('frontend')(req, res, next);
});
app.use((req, res, next) => {
  if (req.url.startsWith('/auth')) return next();
  express.static(path.join(__dirname, 'public'))(req, res, next);
});

// ===========================
// 🚀 Запуск сервера на 0.0.0.0:3000
// ===========================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
