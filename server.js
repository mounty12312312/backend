require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const app = express();
const PORT = process.env.PORT || 3000;

// Разрешаем подключения от фронтенда
const corsOptions = {
  origin: 'https://mounty12312312.github.io', // Разрешаем только этот домен
  optionsSuccessStatus: 200 // Настраиваем статус для предварительных запросов
};
app.use(cors(corsOptions)); // Используем cors для всех маршрутов
app.use(express.json());

// Добавим логирование всех запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  if (req.body) {
    console.log('Body:', req.body);
  }
  next();
});

// Функция для авторизации в Google Sheets
async function authorize() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return auth;
}

// Функция для чтения данных из Google Sheets
async function readData(range) {
  try {
    const auth = await authorize();
    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: range,
    });
    
    return response.data.values || [];
  } catch (error) {
    console.error('Error reading from sheets:', error);
    throw error;
  }
}

// Функция для записи данных в Google Sheets
async function writeData(range, values) {
  try {
    const auth = await authorize();
    const sheets = google.sheets({ version: 'v4', auth });
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: range,
      valueInputOption: 'RAW',
      resource: {
        values: values,
      },
    });
  } catch (error) {
    console.error('Error writing to sheets:', error);
    throw error;
  }
}

// Проверочный эндпоинт
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working' });
});

// Получение баланса
app.get('/api/balance/:telegramId', async (req, res) => {
  try {
    const telegramId = req.params.telegramId;
    const users = await readData('user!A2:B');
    const user = users.find(u => u[0] === telegramId);
    
    if (user) {
      res.json({ success: true, balance: parseFloat(user[1]) });
    } else {
      res.json({ success: true, balance: 0 });
    }
  } catch (error) {
    console.error('Ошибка при получении баланса:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Получение продуктов
app.get('/api/products', async (req, res) => {
  try {
    const products = await readData('product!A2:E');
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Получение истории заказов
app.get('/api/orders', async (req, res) => {
  try {
    const telegramId = req.query.telegramId;
    const orders = await readData('order!A2:D');
    
    const userOrders = orders
      .filter(order => order[0] === telegramId)
      .map(order => {
        const orderData = JSON.parse(order[2]);
        return {
          telegramId: order[0],
          date: order[1],
          products: orderData.products,
          deliveryInfo: orderData.deliveryInfo,
          totalCost: parseFloat(order[3])
        };
      });

    res.json(userOrders);
  } catch (error) {
    console.error('Error fetching orders:', error);
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
      res.json([user[0], user[1]]);
    } else {
      res.status(404).send('User not found');
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
    
    // Получаем текущих пользователей
    const users = await readData('user!A2:B');
    const rowIndex = users.findIndex(u => u[0] === telegramId) + 2; // +2 для учета заголовка
    
    if (rowIndex > 1) {
      // Обновляем баланс в таблице
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

// Обработчик заказа
app.post('/api/order', async (req, res) => {
  try {
    const { telegramId, products, totalCost, date, deliveryInfo } = req.body;
    // Преобразуем telegramId в строку для сравнения
    const telegramIdStr = String(telegramId);

    // 1. Проверяем баланс пользователя
    const users = await readData('user!A2:B');
    const user = users.find(u => u[0] === telegramIdStr);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const currentBalance = parseFloat(user[1]);
    if (currentBalance < totalCost) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    // 2. Обновляем баланс пользователя
    const newBalance = currentBalance - totalCost;
    const userRowIndex = users.findIndex(u => u[0] === telegramIdStr) + 2;
    await writeData(`user!B${userRowIndex}`, [[newBalance]]);

    // 3. Сохраняем заказ
    const orders = await readData('order!A2:D');
    const nextRow = orders.length + 2;
    
    const orderData = {
      products,
      deliveryInfo
    };

    await writeData(`order!A${nextRow}:D${nextRow}`, [[
      telegramIdStr,
      date,
      JSON.stringify(orderData),
      totalCost
    ]]);

    res.json({
      success: true,
      newBalance,
      message: 'Order processed successfully'
    });

  } catch (error) {
    console.error('Error processing order:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  }
});

// Добавляем обработку ошибок
app.use((err, req, res, next) => {
  console.error('Необработанная ошибка:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Внутренняя ошибка сервера' 
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = { readData, writeData };