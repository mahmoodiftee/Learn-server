require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const cors = require("cors");

const port = process.env.PORT || 3001;
const app = express();

// Middleware
app.use(
  cors({
    origin: ["http://localhost:5174", "http://your-production-frontend.com"],
  })
);

app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fc0zsls.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Connect to MongoDB
async function run() {
  try {
    await client.connect();
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    // Get the database and collection
    const db = client.db("Learn");
    const lessonsCollection = db.collection("lessons");
    const ytLinksCollection = db.collection("ytLinks");

    // Create a route to fetch all lessons
    app.get("/lessons", async (req, res) => {
      try {
        const lessons = await lessonsCollection.find({}).toArray();
        res.status(200).json(lessons);
      } catch (error) {
        console.error("Error fetching lessons:", error);
        res.status(500).json({ error: "Failed to fetch lessons" });
      }
    });
    // Create a route to fetch all tutorials
    app.get("/tutorials", async (req, res) => {
      try {
        const tutorials = await ytLinksCollection.find({}).toArray();
        res.status(200).json(tutorials);
      } catch (error) {
        console.error("Error fetching lessons:", error);
        res.status(500).json({ error: "Failed to fetch lessons" });
      }
    });

    app.post("/lessons", async (req, res) => {
      try {
        const { lesson, title, description } = req.body;
        const existingLesson = await lessonsCollection.findOne({ lesson });

        if (existingLesson) {
          return res.status(400).json({
            error: "Lesson already exists",
          });
        }
        const newLesson = { lesson, title, description };
        const result = await lessonsCollection.insertOne(newLesson);
        res.status(201).json({
          message: "Lesson added successfully",
          lesson: newLesson,
        });
      } catch (error) {
        console.error("Error adding lesson:", error);
        res.status(500).json({ error: "Failed to add lesson" });
      }
    });
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

run().catch(console.dir);

// Root route
app.get("/", (req, res) => {
  res.send("Learn server is running");
});

// Start the server
app.listen(port, () => {
  console.log(`Learn server is running on port ${port}`);
});
