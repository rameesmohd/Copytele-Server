const express = require('express');
const cors = require('cors');
const cron = require("node-cron");
const dotenv = require('dotenv');
const connectDB = require('./config/mongoose.js')
const app = express();
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cookieParser = require("cookie-parser");
const userRoute = require('./routes/userRoute.js')
const masterRoute = require('./routes/masterRoute.js')
const managerRoute = require('./routes/managerRoute.js')

dotenv.config();
connectDB()

app.use(helmet({
  contentSecurityPolicy:false,
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "same-origin" },
  dnsPrefetchControl: { allow: false },
  expectCt: { maxAge: 86400 },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { policy: "none" },
  referrerPolicy: { policy: "no-referrer" },
  xssFilter: true
}));

app.set('trust proxy', 1);

const allowedOrigins = [
  'http://localhost:5173',
  'https://your-production-domain.com',
  'http://localhost:3001'
];

const corsOptions = {
   origin: (origin, callback) => {
    // console.log("Incoming origin:", origin);
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({ success: false, message: 'CORS blocked: origin not allowed' });
      }
      console.log(`Blocked CORS request from: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization","X-Requested-With"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions)); 
app.use(express.json({ limit: "10mb" })); 
app.use(express.urlencoded({ limit: "10mb", extended: true })); 
app.use(cookieParser());
require('./services/rolloverService.js')

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100 
});

app.use('/api', limiter);

app.use('/api/master',masterRoute);
app.use('/api/manager',managerRoute);

app.use('/api',userRoute);


app.use((err, req, res, next) => {
    console.error(err.stack);
    if (err.message === 'Not allowed by CORS') {
      res.status(403).send('CORS policy does not allow access from this origin');
    } else {
      console.log("App global err : ", err  );
      
      res.status(500).send('Something broke!');
    }
});

app.listen(process.env.PORT, () => {
    console.log(`Example app listening at http://localhost:${process.env.PORT}`);
})