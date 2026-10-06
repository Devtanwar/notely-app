const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const notemodel = require('./models/note.model');
const userModel = require('./models/user.model');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Authentication check middleware
const authMiddleware = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) {
        return res.status(401).json({ message: "No token provided, please log in" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'superSecretKey_notes_app_2026_dev!');
        req.userId = decoded.userId;
        req.role = decoded.role;
        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
};

// Admin-only middleware
const adminMiddleware = (req, res, next) => {
    if (req.role !== 'admin') {
        return res.status(403).json({ message: "Access forbidden: Admins only" });
    }
    next();
};

// 1. REGISTER
app.post('/auth/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const existingUser = await userModel.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists with this email" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Match with ADMIN_EMAIL from .env
        const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
        const role = email.toLowerCase() === adminEmail ? 'admin' : 'user';

        await userModel.create({ email, password: hashedPassword, role });

        res.status(201).json({ message: "Registration successful! Please login." });
    } catch (error) {
        res.status(500).json({ message: "Error registering user" });
    }
});

// 2. LOGIN
app.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await userModel.findOne({ email });

        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid password" });
        }

        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET || 'superSecretKey_notes_app_2026_dev!',
            { expiresIn: '7d' }
        );

        res.status(200).json({
            message: "Login successful",
            token,
            email: user.email,
            role: user.role
        });
    } catch (error) {
        res.status(500).json({ message: "Error logging in" });
    }
});

// 3. ADMIN / OWNER ROUTE: View all users and all notes safely
app.get('/admin/overview', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const users = await userModel.find().select('-password');
        const allNotes = await notemodel.find();

        const report = users.map(u => {
            // Safe filter: checks if note actually has a userId attached
            const userNotes = allNotes.filter(n => n.userId && n.userId.toString() === u._id.toString());
            return {
                id: u._id,
                email: u.email,
                role: u.role,
                notesCount: userNotes.length,
                notes: userNotes
            };
        });

        res.status(200).json(report);
    } catch (error) {
        console.error("Admin overview error:", error);
        res.status(500).json({ message: "Error loading admin report" });
    }
});

// 4. REGULAR CRUD ROUTES
app.get('/notes', authMiddleware, async (req, res) => {
    try {
        const notes = await notemodel.find({ userId: req.userId });
        res.status(200).json(notes);
    } catch (error) {
        res.status(500).json({ message: "Error fetching notes" });
    }
});

app.post('/notes', authMiddleware, async (req, res) => {
    try {
        const { title, description } = req.body;
        if (!title || !description) {
            return res.status(400).json({ message: "Title and description are required" });
        }

        const newNote = await notemodel.create({
            title,
            description,
            userId: req.userId
        });
        res.status(201).json({ message: "Note created successfully", note: newNote });
    } catch (error) {
        res.status(500).json({ message: "Error creating note" });
    }
});

app.put('/notes/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description } = req.body;

        const updatedNote = await notemodel.findOneAndUpdate(
            { _id: id, userId: req.userId },
            { title, description },
            { new: true }
        );

        if (!updatedNote) {
            return res.status(404).json({ message: "Note not found or unauthorized" });
        }

        res.status(200).json({ message: "Note updated successfully", note: updatedNote });
    } catch (error) {
        res.status(500).json({ message: "Error updating note" });
    }
});

app.delete('/notes/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await notemodel.findOneAndDelete({ _id: id, userId: req.userId });

        if (!deleted) {
            return res.status(404).json({ message: "Note not found or unauthorized" });
        }

        res.status(200).json({ message: "Note deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting note" });
    }
});

module.exports = app;