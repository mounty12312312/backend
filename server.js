require('dotenv').config();

console.log('GOOGLE_SHEETS_CLIENT_EMAIL:', process.env.GOOGLE_SHEETS_CLIENT_EMAIL);
console.log('GOOGLE_PRIVATE_KEY:', process.env.GOOGLE_PRIVATE_KEY);
console.log('SPREADSHEET_ID:', process.env.SPREADSHEET_ID);

const express = require('express');
const cors = require('cors'); // Импортируем cors
const { readData, writeData } = require('./googleSheets');
const app = express();
const PORT = process.env.PORT || 3000;

const corsOptions = {
  origin: 'https://mounty12312312.github.io', // Разрешаем только этот домен
  optionsSuccessStatus: 200 // Настраиваем статус для предварительных запросов
};

app.use(cors(corsOptions)); // Используем cors для всех маршрутов
app.use(express.json());

// Получение списка товаров
app.get('/api/products', async (req, res) => {
  try {
    const products = await readData('product!A2:F');
    res.json(products);
    console.log('Products:', products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Получение информации о пользователе
app.get('/api/user/:telegramId', async (req, res) => {
  try {
    const telegramId = req.params.telegramId;
    const users = await readData('user!A2:B');
    const user = users.find(u => u[0] === telegramId);
    if (user) {
      res.json(user);
      console.log('Telegram ID:', telegramId);
    } else {
      res.status(404).send('User not found');
      console.log('Telegram ID:', telegramId);
    }
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Обновление баланса пользователя
app.post('/api/user/:telegramId/updateBalance', async (req, res) => {
  try {
    const telegramId = req.params.telegramId;
    const newBalance = req.body.balance;
    const users = await readData('user!A2:B');
    const rowIndex = users.findIndex(u => u[0] === telegramId) + 2; // +2 для учета заголовков
    if (rowIndex > 1) {
      await writeData(`user!B${rowIndex}`, [[newBalance]]);
      res.send('Balance updated');
    } else {
      res.status(404).send('User not found');
    }
  } catch (error) {
    console.error('Error updating balance:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Добавление заказа в историю
app.post('/api/order', async (req, res) => {
  try {
    const order = req.body;
    await writeData('orders!A2:A', [[JSON.stringify(order)]]);
    res.send('Order added');
  } catch (error) {
    console.error('Error adding order:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});