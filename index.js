require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const bcrypt = require("bcrypt");
const Joi = require("joi");
const { MongoClient } = require("mongodb");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));

const client = new MongoClient(
  `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_HOST}/${process.env.MONGODB_DATABASE}`
);
client.connect();
const db = client.db(process.env.MONGODB_DATABASE);
const userCollection = db.collection("users");

app.use(session({
  secret: process.env.NODE_SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  saveUninitialized: false,
  cookie: { maxAge: 60 * 60 * 1000 }, 
  store: MongoStore.create({
    mongoUrl: `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_HOST}/${process.env.MONGODB_DATABASE}`
  })
}));

app.use(express.static("public"));

app.get("/", (req, res) => {
    if (req.session.authenticated) {
        res.send(`
            <h1>Hello, ${req.session.name}!</h1>
            <form action="/members" method="GET">
                <button type="submit">Go to Members Area</button>
            </form>
            <form action="/logout" method="GET">
                <button type="submit">Sign Out</button>
            </form>
        `);
    } else {
        res.send(`
            <h1>Home</h1>
            <form action="/signup" method="GET">
                <button type="submit">Sign Up</button>
            </form>
            <form action="/login" method="GET">
                <button type="submit">Log In</button>
            </form>
        `);
    }
});
 
app.get("/signup", (req, res) => {
    res.send(`
        <h1>Create User</h1>
        <form action="/signupSubmit" method="POST" style="display:flex;flex-direction:column;width:200px;">
            <input type="text" name="name" placeholder="Name" required>
            <input type="email" name="email" placeholder="Email" required>
            <input type="password" name="password" placeholder="Password" required>
            <button type="submit">Submit</button>
        </form>
    `);
});
 
app.post("/signupSubmit", async (req, res) => {
    const { name, email, password } = req.body;
 
    const schema = Joi.object({
        name: Joi.string().max(50).required(),
        email: Joi.string().email().required(),
        password: Joi.string().max(50).required()
    });
 
    const validationResult = schema.validate({ name, email, password });
    if (validationResult.error) {
        const msg = validationResult.error.details[0].message;
        return res.send(`
            <p>${msg}</p>
            <a href="/signup">Try again</a>
        `);
    }

    if (!name) return res.send(`<p>Name is required.</p><a href="/signup">Try again</a>`);
    if (!email) return res.send(`<p>Email is required.</p><a href="/signup">Try again</a>`);
    if (!password) return res.send(`<p>Password is required.</p><a href="/signup">Try again</a>`);
 
    const hashedPassword = await bcrypt.hash(password, 10);
 
    await userCollection.insertOne({ name, email, password: hashedPassword });
 
    req.session.authenticated = true;
    req.session.name = name;
    req.session.email = email;
 
    res.redirect("/members");
});

app.get("/login", (req, res) => {
    res.send(`
        <h1>Log In</h1>
        <form action="/loginSubmit" method="POST" style="display:flex;flex-direction:column;width:200px;">
            <input type="email" name="email" placeholder="Email" required>
            <input type="password" name="password" placeholder="Password" required>
            <button type="submit">Submit</button>
        </form>
    `);
});
 
app.post("/loginSubmit", async (req, res) => {
    const { email, password } = req.body;
 
    const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().max(50).required()
    });
 
    const validationResult = schema.validate({ email, password });
    if (validationResult.error) {
        return res.send(`
            <p>Invalid email/password combination.</p>
            <a href="/login">Try again</a>
        `);
    }
 
    const user = await userCollection.findOne({ email });
    if (!user) {
        return res.send(`
            <p>Invalid email/password combination.</p>
            <a href="/login">Try again</a>
        `);
    }
 
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
        return res.send(`
            <p>Invalid email/password combination.</p>
            <a href="/login">Try again</a>
        `);
    }
 
    req.session.authenticated = true;
    req.session.name = user.name;
    req.session.email = user.email;
 
    res.redirect("/members");
});
 
app.get("/members", (req, res) => {
    if (!req.session.authenticated) {
        return res.redirect("/");
    }

    const images = ["image1.gif", "image2.webp", "image3.gif"];
    const randomImage = images[Math.floor(Math.random() * images.length)];
 
    res.send(`
        <h1>Hello, ${req.session.name}.</h1>
        <img src="/${randomImage}" style="width:300px;"><br><br>
        <form action="/logout" method="GET">
            <button type="submit">Sign Out</button>
        </form>
    `);
});
 
app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/");
});
 
app.use((req, res) => {
    res.status(404).send("<h1>Page not found - 404</h1>");
});
 

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});