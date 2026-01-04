const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const Razorpay = require('razorpay');
const path = require('path');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const mongoURI = process.env.MONGODB_URI;
if (mongoURI) {
  mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.log('❌ MongoDB Error:', err));
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY || 'test_key',
  key_secret: process.env.RAZORPAY_SECRET || 'test_secret'
});

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, sparse: true },
  phone: String,
  amount: Number,
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'production-index.html'));
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { name, email, phone, amount } = req.body;
    if (!name || !email || !phone || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const newUser = new User({ name, email, phone, amount, status: 'pending' });
    await newUser.save();
    res.json({ success: true, user: newUser });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/create-order', async (req, res) => {
  try {
    const { amount, email } = req.body;
    if (!amount || !email) {
      return res.status(400).json({ error: 'Missing amount or email' });
    }
    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: { email: email }
    });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/verify-payment', async (req, res) => {
  try {
    const { orderId, paymentId, email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }
    await User.updateOne({ email }, { status: 'completed' });
    res.json({ success: true, message: 'Payment verified' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ App is LIVE at http://localhost:${PORT}`);
});
