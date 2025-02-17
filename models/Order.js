const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  telegramId: { 
    type: String, 
    required: true 
  },
  products: { 
    type: Object, 
    required: true 
  },
  totalCost: { 
    type: Number, 
    required: true 
  },
  status: { 
    type: String, 
    default: 'pending' 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('Order', orderSchema); 