require('dotenv').config();

console.log('GOOGLE_SHEETS_CLIENT_EMAIL:', process.env.GOOGLE_SHEETS_CLIENT_EMAIL);
console.log('GOOGLE_PRIVATE_KEY:', process.env.GOOGLE_PRIVATE_KEY);
console.log('SPREADSHEET_ID:', process.env.SPREADSHEET_ID);

const express = require('express');
const { readData, writeData } = require('./googleSheets');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Получение списка товаров
app.get('/api/products', async (req, res) => {
  const products = await readData('product!A2:F');
  res.json(products);
});

// Получение информации о пользователе
app.get('/api/user/:telegramId', async (req, res) => {
  const telegramId = req.params.telegramId;
  const users = await readData('user!A2:B');
  const user = users.find(u => u[0] === telegramId);
  if (user) {
    res.json(user);
  } else {
    res.status(404).send('User not found');
  }
});

// Обновление баланса пользователя
app.post('/api/user/:telegramId/updateBalance', async (req, res) => {
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
});

// Добавление заказа в историю
app.post('/api/order', async (req, res) => {
  const order = req.body;
  await writeData('orders!A2:A', [[JSON.stringify(order)]]);
  res.send('Order added');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});