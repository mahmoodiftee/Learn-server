require("dotenv").config();
const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const cors = require("cors");

const port = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fc0zsls.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: "1",
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const db = client.db("Learn");
    const lessonsCollection = db.collection("lessons");
    const ytLinksCollection = db.collection("ytLinks");
    const usersCollection = db.collection("users");

    app.get("/tutorials", async (req, res) => {
      try {
        const tutorials = await ytLinksCollection.find({}).toArray();
        res.status(200).json(tutorials);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch lessons" });
      }
    });

    app.get("/lessons/:lessonId", async (req, res) => {
      try {
        const lessonId = req.params.lessonId;
        const objectId = new ObjectId(lessonId);
        const lesson = await lessonsCollection.findOne({ _id: objectId });
        if (!lesson) {
          return res.status(404).json({ error: "Lesson not found" });
        }
        res.status(200).json(lesson);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch lesson" });
      }
    });

    app.get("/lessons", async (req, res) => {
      try {
        const lessons = await lessonsCollection.find({}).toArray();
        res.status(200).json(lessons);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch lessons" });
      }
    });

    app.get("/users", async (req, res) => {
      try {
        const users = await usersCollection.find({}).toArray();
        res.status(200).json(users);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch users" });
      }
    });

    app.post("/lessons", async (req, res) => {
      try {
        const { lesson, title, description } = req.body;
        const existingLesson = await lessonsCollection.findOne({ lesson });
        if (existingLesson) {
          return res.status(400).json({ error: "Lesson already exists" });
        }
        const newLesson = { lesson, title, description };
        const result = await lessonsCollection.insertOne(newLesson);
        res.status(201).json({ message: "Lesson added successfully", lesson: newLesson });
      } catch (error) {
        res.status(500).json({ error: "Failed to add lesson" });
      }
    });

    app.post("/registration", async (req, res) => {
      try {
        const { name, email, password, profileImage } = req.body;
        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
          return res.status(400).json({ error: "Email already exists. Please use a different email." });
        }
        const newUser = { name, email, password, profileImage: profileImage || null, role: "user" };
        const result = await usersCollection.insertOne(newUser);
        res.status(201).json({ message: "User registered successfully", userId: result.insertedId });
      } catch (error) {
        res.status(500).json({ error: "An error occurred during registration." });
      }
    });

    app.post("/login", async (req, res) => {
      try {
        const { email, password } = req.body;
        const user = await usersCollection.findOne({ email });
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
        if (password !== user.password) {
          return res.status(401).json({ error: "Invalid password" });
        }
        res.status(200).json({ message: "Login successful", user: { id: user._id, name: user.name, email: user.email, profileImage: user.profileImage, role: user.role } });
      } catch (error) {
        res.status(500).json({ error: "An error occurred during login" });
      }
    });

    app.patch("/lessons/:lessonId", async (req, res) => {
      try {
        const { lesson, title } = req.body;
        const lessonId = req.params.lessonId;
        const existingLesson = await lessonsCollection.findOne({ _id: new ObjectId(lessonId) });
        if (!existingLesson) {
          return res.status(404).json({ success: false, message: "Lesson not found." });
        }
        const duplicateLesson = await lessonsCollection.findOne({
          lesson: lesson,
          _id: { $ne: new ObjectId(lessonId) },
        });
        if (duplicateLesson) {
          return res.status(400).json({ success: false, message: "Lesson number already exists." });
        }
        const updatedLesson = await lessonsCollection.findOneAndUpdate(
          { _id: new ObjectId(lessonId) },
          { $set: { lesson, title } },
          { returnDocument: "after" }
        );
        res.status(200).json({ success: true, message: "Lesson updated successfully", data: updatedLesson.value });
      } catch (error) {
        res.status(500).json({ success: false, message: "Failed to update lesson" });
      }
    });

    app.patch("/users/:id", async (req, res) => {
      const { id } = req.params;
      const { role } = req.body;
      try {
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid user ID" });
        }
        const query = { _id: new ObjectId(id) };
        const updatedUser = await usersCollection.findOneAndUpdate(query, { $set: { role } }, { returnDocument: "after" });
        res.status(200).json(updatedUser.value);
      } catch (error) {
        res.status(500).json({ message: "Error updating role", error });
      }
    });

    app.patch("/lessons/:lessonId/vocabulary", async (req, res) => {
      try {
        const lessonId = req.params.lessonId;
        const { word, pronunciation, meaning, when, adminEmail } = req.body;
        const lesson = await lessonsCollection.findOne({ lesson: parseInt(lessonId) });
        if (!lesson) {
          return res.status(404).json({ error: "Lesson not found" });
        }
        const newVocab = { word, pronunciation, meaning, when, lessonNo: parseInt(lessonId), adminEmail };
        const updateResult = await lessonsCollection.updateOne(
          { lesson: parseInt(lessonId) },
          { $push: { vocab: newVocab } }
        );
        if (updateResult.modifiedCount === 0) {
          return res.status(400).json({ error: "Failed to add vocabulary" });
        }
        const updatedLesson = await lessonsCollection.findOne({ lesson: parseInt(lessonId) });
        res.status(200).json({ message: "Vocabulary added successfully", updatedLesson });
      } catch (error) {
        res.status(500).json({ error: "Failed to add vocabulary" });
      }
    });

    app.patch("/lessons/:lessonId/vocabulary/:pronunciation", async (req, res) => {
      try {
        const { lessonId, pronunciation } = req.params;
        const { word, meaning, when, lessonNo, adminEmail } = req.body;
        const objectId = new ObjectId(lessonId);
        const lesson = await lessonsCollection.findOne({ _id: objectId });
        if (!lesson) {
          return res.status(404).json({ error: "Lesson not found" });
        }
        const vocabIndex = lesson.vocab.findIndex((vocab) => vocab.pronunciation === pronunciation);
        if (vocabIndex === -1) {
          return res.status(404).json({ error: "Vocabulary not found" });
        }
        lesson.vocab[vocabIndex] = { ...lesson.vocab[vocabIndex], word, meaning, when, lessonNo, adminEmail };
        const updateResult = await lessonsCollection.updateOne({ _id: objectId }, { $set: { vocab: lesson.vocab } });
        if (updateResult.modifiedCount === 0) {
          return res.status(400).json({ error: "Failed to update vocabulary" });
        }
        const updatedLesson = await lessonsCollection.findOne({ _id: objectId });
        res.status(200).json({ message: "Vocabulary updated successfully", updatedLesson });
      } catch (error) {
        res.status(500).json({ error: "Failed to update vocabulary" });
      }
    });

    app.delete("/lessons/:lessonId", async (req, res) => {
      try {
        const lessonId = req.params.lessonId;
        const objectId = new ObjectId(lessonId);
        const lesson = await lessonsCollection.findOne({ _id: objectId });
        if (!lesson) {
          return res.status(404).json({ error: "Lesson not found" });
        }
        await lessonsCollection.deleteOne({ _id: objectId });
        res.status(200).json({ message: "Lesson deleted successfully" });
      } catch (error) {
        res.status(500).json({ error: "Failed to delete lesson" });
      }
    });

    app.delete("/lessons/:lessonId/vocabulary/:pronunciation", async (req, res) => {
      try {
        const { lessonId, pronunciation } = req.params;
        const objectId = new ObjectId(lessonId);
        const lesson = await lessonsCollection.findOne({ _id: objectId });
        if (!lesson) {
          return res.status(404).json({ error: "Lesson not found" });
        }
        const vocabIndex = lesson.vocab.findIndex((vocab) => vocab.pronunciation === pronunciation);
        if (vocabIndex === -1) {
          return res.status(404).json({ error: "Vocabulary not found" });
        }
        lesson.vocab.splice(vocabIndex, 1);
        const updateResult = await lessonsCollection.updateOne({ _id: objectId }, { $set: { vocab: lesson.vocab } });
        if (updateResult.modifiedCount === 0) {
          return res.status(400).json({ error: "Failed to delete vocabulary" });
        }
        const updatedLesson = await lessonsCollection.findOne({ _id: objectId });
        res.status(200).json({ message: "Vocabulary deleted successfully", updatedLesson });
      } catch (error) {
        res.status(500).json({ error: "Failed to delete vocabulary" });
      }
    });

  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

run();

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
