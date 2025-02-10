require('dotenv').config();

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
      res.json({ success: true, newBalance });
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
    const orders = await readData('order!A2:D');
    const nextRow = orders.length + 2; // +2 для учета заголовков
    await writeData(`order!A${nextRow}:D${nextRow}`, [[order.telegramId, order.date, JSON.stringify(order.products), order.totalCost]]);
    res.json({ success: true, order });
  } catch (error) {
    console.error('Error adding order:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Получение истории заказов
app.get('/api/orders', async (req, res) => {
  const { telegramId } = req.query; // Получаем telegramId из параметров запроса
  try {
    const orders = await readData('order!A2:D'); // Читаем данные из таблицы

    // Фильтруем заказы по telegramId
    const filteredOrders = orders
      .filter(order => order[0] === telegramId) // Оставляем только заказы с нужным telegramId
      .map(order => ({
        telegramId: order[0],
        date: order[1],
        products: JSON.parse(order[2]), // Парсим JSON с товарами
        totalCost: parseFloat(order[3]) // Преобразуем стоимость в число
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date)); // Сортировка по дате

    console.log('Filtered Orders:', filteredOrders);
    res.json(filteredOrders); // Возвращаем отфильтрованные заказы
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});