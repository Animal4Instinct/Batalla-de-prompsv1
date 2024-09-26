/**
 * Conecta a la base de datos MongoDB utilizando Mongoose.
 * Si la conexión falla, el proceso se detendrá.
 */
const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.error('MongoDB URI is not defined');
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  }
};
