require("dotenv").config();
const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcrypt"); // For password hashing
const jwt = require("jsonwebtoken"); // For JWT token generation
const cors = require("cors");

const port = process.env.PORT || 3001;
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
    const usersCollection = db.collection("users");
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
    // Create a route to fetch a single lesson by its lesson number
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
        console.error("Error fetching lesson:", error);
        res.status(500).json({ error: "Failed to fetch lesson" });
      }
    });
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
    app.get("/users", async (req, res) => {
      try {
        const users = await usersCollection.find({}).toArray();
        res.status(200).json(users);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Failed to fetch users" });
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

    app.post("/registration", async (req, res) => {
      try {
        const { name, email, password, profileImage } = req.body;

        // Check if the email already exists
        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
          return res.status(400).json({
            error: "Email already exists. Please use a different email.",
          });
        }

        // Hash the password before storing it
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
          name,
          email,
          password: hashedPassword,
          profileImage: profileImage || null,
          role: "user",
        };

        const result = await usersCollection.insertOne(newUser);
        res.status(201).json({
          message: "User registered successfully",
          userId: result.insertedId,
        });
      } catch (error) {
        console.error("Error during registration:", error);
        res
          .status(500)
          .json({ error: "An error occurred during registration." });
      }
    });

    app.post("/login", async (req, res) => {
      try {
        console.log("Login request received", req.body); // Log request body

        const { email, password } = req.body;

        // Find user by email
        const user = await usersCollection.findOne({ email });
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        // Check if the password is correct
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          return res.status(401).json({ error: "Invalid password" });
        }

        // Generate JWT token
        const token = jwt.sign(
          { userId: user._id, email: user.email },
          process.env.JWT_SECRET,
          { expiresIn: "3h" }
        );

        // Send response with token and user info (without password)
        res.status(200).json({
          message: "Login successful",
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            profileImage: user.profileImage,
            role: user.role,
          },
          token,
        });
      } catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({ error: "An error occurred during login" });
      }
    });

    app.patch("/lessons/:lessonId", async (req, res) => {
      try {
        const { lesson, title } = req.body;
        const lessonId = req.params.lessonId;

        // Check if the lesson with the given ID exists
        const existingLesson = await lessonsCollection.findOne({
          _id: new ObjectId(lessonId), // Ensure the lesson exists first
        });

        if (!existingLesson) {
          return res.status(404).json({
            success: false,
            message: "Lesson not found.",
          });
        }

        // Check if the new lesson number already exists (excluding the current lesson being updated)
        const duplicateLesson = await lessonsCollection.findOne({
          lesson: lesson,
          _id: { $ne: new ObjectId(lessonId) }, // Exclude the current lesson from the search
        });

        if (duplicateLesson) {
          return res.status(400).json({
            success: false,
            message: "Lesson number already exists.",
          });
        }

        // Update the lesson
        const updatedLesson = await lessonsCollection.findOneAndUpdate(
          { _id: new ObjectId(lessonId) }, // Find the lesson by its _id
          { $set: { lesson, title } }, // Update lesson number and title
          { returnDocument: "after" } // Return the updated document
        );

        res.status(200).json({
          success: true,
          message: "Lesson updated successfully",
          data: updatedLesson.value,
        });
      } catch (error) {
        console.error("Error updating lesson:", error);
        res
          .status(500)
          .json({ success: false, message: "Failed to update lesson" });
      }
    });

    app.patch("/users/:id", async (req, res) => {
      const { id } = req.params; // userId from the frontend
      const { role } = req.body; // new role to update

      console.log("Incoming ID:", id);

      try {
        // Check if the ID is a valid MongoDB ObjectId
        if (!ObjectId.isValid(id)) {
          console.error("Invalid ID format");
          return res.status(400).json({ message: "Invalid user ID" });
        }

        const query = { _id: new ObjectId(id) };
        console.log("Query to MongoDB:", query);

        // Update the role in the database
        const updatedUser = await usersCollection.findOneAndUpdate(
          query,
          { $set: { role } },
          { returnDocument: "after" } // Return the updated document
        );

        console.log("Updated User:", updatedUser.value);
        res.status(200).json(updatedUser.value);
      } catch (error) {
        console.error("Error updating role:", error);
        res.status(500).json({ message: "Error updating role", error });
      }
    });

    app.patch("/lessons/:lessonId/vocabulary", async (req, res) => {
      try {
        const lessonId = req.params.lessonId;
        const { word, pronunciation, meaning, when, adminEmail } = req.body;

        // Find the lesson by lessonId (matching lesson number)
        const lesson = await lessonsCollection.findOne({
          lesson: parseInt(lessonId),
        });

        if (!lesson) {
          return res.status(404).json({ error: "Lesson not found" });
        }

        // Create the new vocabulary object
        const newVocab = {
          word,
          pronunciation,
          meaning,
          when,
          lessonNo: parseInt(lessonId),
          adminEmail,
        };

        // Use the $push operator to add the new vocab to the lesson's vocab array
        const updateResult = await lessonsCollection.updateOne(
          { lesson: parseInt(lessonId) }, // Match lesson by lesson number
          { $push: { vocab: newVocab } } // Push the new vocab into the vocab array
        );

        if (updateResult.modifiedCount === 0) {
          return res.status(400).json({ error: "Failed to add vocabulary" });
        }

        // Fetch the updated lesson with the new vocabulary
        const updatedLesson = await lessonsCollection.findOne({
          lesson: parseInt(lessonId),
        });

        res.status(200).json({
          message: "Vocabulary added successfully",
          updatedLesson,
        });
      } catch (error) {
        console.error("Error adding vocabulary:", error);
        res.status(500).json({ error: "Failed to add vocabulary" });
      }
    });

    // Create a route to delete a lesson by its lessonId
    app.delete("/lessons/:lessonId", async (req, res) => {
      try {
        const lessonId = req.params.lessonId;
        const objectId = new ObjectId(lessonId);

        // Check if the lesson exists
        const lesson = await lessonsCollection.findOne({ _id: objectId });
        if (!lesson) {
          return res.status(404).json({ error: "Lesson not found" });
        }

        // Delete the lesson
        const result = await lessonsCollection.deleteOne({ _id: objectId });

        // Check if the lesson was deleted
        if (result.deletedCount === 0) {
          return res.status(500).json({ error: "Failed to delete the lesson" });
        }

        res.status(200).json({ message: "Lesson deleted successfully" });
      } catch (error) {
        console.error("Error deleting lesson:", error);
        res.status(500).json({ error: "Failed to delete lesson" });
      }
    });
    app.delete("/users/:id", async (req, res) => {
      const { id } = req.params;
      try {
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid user ID" });
        }

        const query = { _id: new ObjectId(id) };
        const result = await usersCollection.deleteOne(query);

        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({ message: "User deleted successfully" });
      } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ message: "Error deleting user", error });
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
